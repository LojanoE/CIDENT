import type {
  Certificado,
  EstadoPresupuesto,
  GenerarCertificadoInput,
  GenerarPresupuestoInput,
  GenerarRecetaInput,
  GenerarResumenAtencionInput,
  Presupuesto,
  Receta,
  TratamientoCatalogo,
} from "@cident/shared";
import { collection, doc, getDoc, getDocs, updateDoc, type Firestore } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../app/firebase";

export function recetasCollection(patientId: string, firestore: Firestore = db) {
  return collection(firestore, "patients", patientId, "prescriptions");
}

export function certificadosCollection(patientId: string, firestore: Firestore = db) {
  return collection(firestore, "patients", patientId, "certificates");
}

export function presupuestosCollection(patientId: string, firestore: Firestore = db) {
  return collection(firestore, "patients", patientId, "budgets");
}

const generarPresupuestoCallable = httpsCallable<
  GenerarPresupuestoInput,
  { id: string; codigo: string; storagePath: string }
>(functions, "generarPresupuesto");

const generarRecetaCallable = httpsCallable<GenerarRecetaInput, { id: string; codigo: string; storagePath: string }>(
  functions,
  "generarReceta",
);

const generarCertificadoCallable = httpsCallable<
  GenerarCertificadoInput,
  { id: string; codigo: string; storagePath: string }
>(functions, "generarCertificado");

const generarResumenAtencionCallable = httpsCallable<GenerarResumenAtencionInput, { storagePath: string }>(
  functions,
  "generarResumenAtencion",
);

export async function generarReceta(input: GenerarRecetaInput) {
  const res = await generarRecetaCallable(input);
  return res.data;
}

export async function generarCertificado(input: GenerarCertificadoInput) {
  const res = await generarCertificadoCallable(input);
  return res.data;
}

export async function generarResumenAtencion(input: GenerarResumenAtencionInput) {
  const res = await generarResumenAtencionCallable(input);
  return res.data;
}

export async function generarPresupuesto(input: GenerarPresupuestoInput) {
  const res = await generarPresupuestoCallable(input);
  return res.data;
}

/** Las rules solo dejan tocar estos tres campos de un presupuesto ya emitido. */
export async function actualizarEstadoPresupuesto(
  patientId: string,
  presupuestoId: string,
  estado: EstadoPresupuesto,
  uid: string,
) {
  await updateDoc(doc(presupuestosCollection(patientId), presupuestoId), {
    estado,
    estadoActualizadoAt: new Date().toISOString(),
    estadoActualizadoBy: uid,
  });
}

/** Catálogo de tratamientos del centro (nombre + último precio), más usados primero. */
export async function obtenerCatalogoTratamientos(centroId: string): Promise<TratamientoCatalogo[]> {
  const snap = await getDocs(collection(db, "centros", centroId, "tratamientos"));
  return snap.docs.map((d) => d.data() as TratamientoCatalogo).sort((a, b) => b.usos - a.usos);
}

/** IVA usado por última vez en el centro, para prellenar el formulario. */
export async function obtenerIvaPorDefecto(centroId: string): Promise<number> {
  const snap = await getDoc(doc(db, "centros", centroId));
  const iva = (snap.data() as { presupuestoIva?: number } | undefined)?.presupuestoIva;
  return typeof iva === "number" ? iva : 0;
}

export type { Certificado, Presupuesto, Receta, TratamientoCatalogo };
