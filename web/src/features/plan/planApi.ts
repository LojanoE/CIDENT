import type { ItemPlan, Presupuesto } from "@cident/shared";
import {
  collection,
  deleteDoc,
  deleteField,
  getDocs,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../app/firebase";

function itemsRef(patientId: string) {
  return collection(db, "patients", patientId, "planTratamiento");
}

/** Plan del paciente por orden de ejecución. Se ordena en el cliente (sin índice compuesto). */
export function escucharPlan(
  patientId: string,
  centroId: string,
  onData: (items: ItemPlan[]) => void,
  onError: (err: unknown) => void,
) {
  const q = query(itemsRef(patientId), where("centroId", "==", centroId));
  return onSnapshot(
    q,
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as ItemPlan);
      lista.sort((a, b) => a.orden - b.orden || a.createdAt.localeCompare(b.createdAt));
      onData(lista);
    },
    onError,
  );
}

interface DatosItem {
  tratamiento: string;
  pieza?: string;
}

export async function agregarItem(
  patientId: string,
  centroId: string,
  uid: string,
  datos: DatosItem,
  existentes: readonly ItemPlan[],
  origen?: ItemPlan["origen"],
): Promise<void> {
  const ref = doc(itemsRef(patientId));
  const orden = existentes.reduce((max, i) => Math.max(max, i.orden), 0) + 1;
  const item: ItemPlan = {
    id: ref.id,
    centroId,
    patientId,
    tratamiento: datos.tratamiento,
    ...(datos.pieza ? { pieza: datos.pieza } : {}),
    estado: "pendiente",
    orden,
    ...(origen ? { origen } : {}),
    createdAt: new Date().toISOString(),
    createdBy: uid,
  };
  await setDoc(ref, item);
}

export async function editarItem(patientId: string, itemId: string, datos: DatosItem): Promise<void> {
  await updateDoc(doc(itemsRef(patientId), itemId), {
    tratamiento: datos.tratamiento,
    pieza: datos.pieza ? datos.pieza : deleteField(),
    updatedAt: new Date().toISOString(),
  });
}

export async function marcarRealizado(
  patientId: string,
  itemId: string,
  visitId: string,
  fecha: string,
  uid: string,
  nota: string,
): Promise<void> {
  await updateDoc(doc(itemsRef(patientId), itemId), {
    estado: "realizado",
    realizado: { visitId, fecha, uid, nota },
    updatedAt: new Date().toISOString(),
  });
}

export async function desmarcar(patientId: string, itemId: string): Promise<void> {
  await updateDoc(doc(itemsRef(patientId), itemId), {
    estado: "pendiente",
    realizado: deleteField(),
    updatedAt: new Date().toISOString(),
  });
}

export async function descartar(patientId: string, itemId: string): Promise<void> {
  await updateDoc(doc(itemsRef(patientId), itemId), {
    estado: "descartado",
    updatedAt: new Date().toISOString(),
  });
}

export async function eliminarItem(patientId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(itemsRef(patientId), itemId));
}

/**
 * Una línea del presupuesto → un ítem pendiente (con su cantidad repetida). Si ese presupuesto ya
 * se importó, no hace nada. Devuelve cuántos ítems se crearon.
 */
export async function importarDesdePresupuesto(
  presupuesto: Presupuesto,
  uid: string,
  existentes: readonly ItemPlan[],
): Promise<number> {
  if (existentes.some((i) => i.origen?.budgetId === presupuesto.id)) return 0;
  let creados = 0;
  let acumulado = [...existentes];
  for (const linea of presupuesto.lineas) {
    for (let n = 0; n < Math.max(1, linea.cantidad); n++) {
      const datos = { tratamiento: linea.tratamiento, pieza: linea.pieza };
      await agregarItem(presupuesto.patientId, presupuesto.centroId, uid, datos, acumulado, {
        budgetId: presupuesto.id,
        codigo: presupuesto.codigoUnico,
      });
      acumulado = [...acumulado, { orden: acumulado.reduce((m, i) => Math.max(m, i.orden), 0) + 1 } as ItemPlan];
      creados++;
    }
  }
  return creados;
}

/**
 * Al aceptar un presupuesto: lee el plan actual y le agrega sus líneas. Idempotente: si ese
 * presupuesto ya se importó (p. ej. se aceptó, se revirtió y se volvió a aceptar) no duplica.
 */
export async function importarPresupuestoAceptado(presupuesto: Presupuesto, uid: string): Promise<number> {
  const snap = await getDocs(query(itemsRef(presupuesto.patientId), where("centroId", "==", presupuesto.centroId)));
  const existentes = snap.docs.map((d) => d.data() as ItemPlan);
  return importarDesdePresupuesto(presupuesto, uid, existentes);
}

/** Presupuestos del paciente que aún pueden convertirse en plan (pendientes o aceptados). */
export async function obtenerPresupuestosImportables(patientId: string, centroId: string): Promise<Presupuesto[]> {
  const snap = await getDocs(
    query(collection(db, "patients", patientId, "budgets"), where("centroId", "==", centroId)),
  );
  return snap.docs
    .map((d) => d.data() as Presupuesto)
    .filter((p) => p.estado === "pendiente" || p.estado === "aceptado")
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}
