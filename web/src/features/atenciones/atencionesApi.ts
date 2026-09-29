import type { Atencion, AtencionInput, EstadoAtencion } from "@cident/shared";
import { collection, doc, getDoc, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import { db } from "../../app/firebase";

export function atencionesCollection(patientId: string, firestore: Firestore = db) {
  return collection(firestore, "patients", patientId, "visits");
}

function conCpoTotal(datos: AtencionInput): Atencion["cpo"] {
  return { ...datos.cpo, total: datos.cpo.c + datos.cpo.p + datos.cpo.o };
}

/**
 * Crea una atención nueva. `estado` decide si queda como borrador o
 * finalizada de una vez (el formulario ofrece ambos botones desde el inicio,
 * a diferencia del legado que exigía crear el borrador primero).
 */
export async function crearAtencion(
  patientId: string,
  centroId: string,
  uid: string,
  datos: AtencionInput,
  estado: EstadoAtencion,
): Promise<string> {
  const ref = doc(atencionesCollection(patientId));
  const ahora = new Date().toISOString();
  const atencion: Atencion = {
    visitId: ref.id,
    centroId,
    patientId,
    fecha: datos.fecha,
    motivo: datos.motivo,
    problemaActual: datos.problemaActual,
    antecedentes: datos.antecedentes,
    signosVitales: datos.signosVitales,
    examenEstomatognatico: datos.examenEstomatognatico,
    indicadores: datos.indicadores,
    cpo: conCpoTotal(datos),
    estado,
    notas: datos.notas,
    createdAt: ahora,
    createdBy: uid,
    finalizedAt: estado === "final" ? ahora : null,
    finalizedBy: estado === "final" ? uid : null,
  };
  await setDoc(ref, atencion);
  return ref.id;
}

/**
 * Actualiza una atención existente (borrador → borrador, borrador → final,
 * o edición de una final por el admin). Las reglas de Firestore rechazan
 * cualquier intento de modificar una atención ya finalizada salvo admin.
 */
export async function actualizarAtencion(
  patientId: string,
  visitId: string,
  datos: AtencionInput,
  estado: EstadoAtencion,
  uid: string,
  yaFinalizada: boolean,
): Promise<void> {
  const cambios: Partial<Atencion> = {
    fecha: datos.fecha,
    motivo: datos.motivo,
    problemaActual: datos.problemaActual,
    antecedentes: datos.antecedentes,
    signosVitales: datos.signosVitales,
    examenEstomatognatico: datos.examenEstomatognatico,
    indicadores: datos.indicadores,
    cpo: conCpoTotal(datos),
    estado,
    notas: datos.notas,
  };
  if (estado === "final" && !yaFinalizada) {
    cambios.finalizedAt = new Date().toISOString();
    cambios.finalizedBy = uid;
  }
  await updateDoc(doc(db, "patients", patientId, "visits", visitId), cambios);
}

export async function obtenerAtencion(patientId: string, visitId: string): Promise<Atencion | null> {
  const snap = await getDoc(doc(db, "patients", patientId, "visits", visitId));
  return snap.exists() ? (snap.data() as Atencion) : null;
}
