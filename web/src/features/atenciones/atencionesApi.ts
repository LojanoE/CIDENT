import type { Atencion, AtencionInput } from "@cident/shared";
import { collection, doc, getDoc, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../app/firebase";

export function atencionesCollection(patientId: string, firestore: Firestore = db) {
  return collection(firestore, "patients", patientId, "visits");
}

function conCpoTotal(datos: AtencionInput): Atencion["cpo"] {
  return { ...datos.cpo, total: datos.cpo.c + datos.cpo.p + datos.cpo.o };
}

/** Crea una atención nueva. Siempre nace como borrador; se finaliza desde la barra de estado. */
export async function crearAtencion(
  patientId: string,
  centroId: string,
  uid: string,
  datos: AtencionInput,
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
    estado: "draft",
    notas: datos.notas,
    createdAt: ahora,
    createdBy: uid,
    finalizedAt: null,
    finalizedBy: null,
  };
  await setDoc(ref, atencion);
  return ref.id;
}

/**
 * Guarda los datos de una atención en borrador. Guardar ya no cambia el estado:
 * finalizar, reabrir, eliminar y anular son acciones aparte (barra de estado).
 */
export async function actualizarAtencion(patientId: string, visitId: string, datos: AtencionInput): Promise<void> {
  const cambios: Partial<Atencion> = {
    fecha: datos.fecha,
    motivo: datos.motivo,
    problemaActual: datos.problemaActual,
    antecedentes: datos.antecedentes,
    signosVitales: datos.signosVitales,
    examenEstomatognatico: datos.examenEstomatognatico,
    indicadores: datos.indicadores,
    cpo: conCpoTotal(datos),
    notas: datos.notas,
    updatedAt: new Date().toISOString(),
  };
  await updateDoc(doc(db, "patients", patientId, "visits", visitId), cambios);
}

/** Borrador → finalizada. Las reglas solo dejan pasar draft → final. */
export async function finalizarAtencion(patientId: string, visitId: string, uid: string): Promise<void> {
  const ahora = new Date().toISOString();
  await updateDoc(doc(db, "patients", patientId, "visits", visitId), {
    estado: "final",
    finalizedAt: ahora,
    finalizedBy: uid,
    updatedAt: ahora,
  });
}

/**
 * Finalizada → borrador. Las reglas exigen tocar SOLO los campos de estado
 * (por eso aquí no va `updatedAt`); `reabiertaAt/By` dejan rastro de quién reabrió.
 */
export async function reabrirAtencion(patientId: string, visitId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, "patients", patientId, "visits", visitId), {
    estado: "draft",
    finalizedAt: null,
    finalizedBy: null,
    reabiertaAt: new Date().toISOString(),
    reabiertaBy: uid,
  });
}

const eliminarCallable = httpsCallable<{ patientId: string; visitId: string }, { ok: true }>(
  functions,
  "eliminarAtencion",
);
const anularCallable = httpsCallable<{ patientId: string; visitId: string; motivo: string }, { ok: true }>(
  functions,
  "anularAtencion",
);

export async function eliminarAtencion(patientId: string, visitId: string): Promise<void> {
  await eliminarCallable({ patientId, visitId });
}

export async function anularAtencion(patientId: string, visitId: string, motivo: string): Promise<void> {
  await anularCallable({ patientId, visitId, motivo });
}

export async function obtenerAtencion(patientId: string, visitId: string): Promise<Atencion | null> {
  const snap = await getDoc(doc(db, "patients", patientId, "visits", visitId));
  return snap.exists() ? (snap.data() as Atencion) : null;
}
