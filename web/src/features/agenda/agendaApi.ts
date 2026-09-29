import type { Cita, CitaInput, EstadoCita } from "@cident/shared";
import { collection, doc, getDoc, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import { db } from "../../app/firebase";

export function appointmentsCollection(firestore: Firestore = db) {
  return collection(firestore, "appointments");
}

/**
 * Las citas se escriben desde el cliente: el solapamiento advierte pero no
 * bloquea, así que no hace falta una callable ni una transacción (no hay clave
 * única que proteger). La autoría queda en el propio documento.
 */
export async function crearCita(
  input: CitaInput,
  centroId: string,
  uid: string,
  profesionalNombre: string,
): Promise<string> {
  const ref = doc(appointmentsCollection());
  const ahora = new Date().toISOString();
  await setDoc(ref, {
    appointmentId: ref.id,
    centroId,
    patientId: input.patientId ?? null,
    pacienteNombre: input.pacienteNombre,
    pacienteTelefono: input.pacienteTelefono,
    profesionalUid: input.profesionalUid,
    profesionalNombre,
    inicio: input.inicio,
    fin: input.fin,
    motivo: input.motivo,
    estado: input.estado,
    notas: input.notas,
    visitId: null,
    createdAt: ahora,
    createdBy: uid,
    updatedAt: ahora,
    updatedBy: uid,
    canceladaEn: null,
    canceladaPor: null,
    motivoCancelacion: "",
  } satisfies Cita);
  return ref.id;
}

export async function obtenerCita(appointmentId: string): Promise<Cita | null> {
  const snap = await getDoc(doc(appointmentsCollection(), appointmentId));
  return snap.exists() ? (snap.data() as Cita) : null;
}

/** `patientId` y `visitId` no se tocan aquí: los mueven `vincularCita*`. */
export async function actualizarCita(
  appointmentId: string,
  input: CitaInput,
  uid: string,
  profesionalNombre: string,
): Promise<void> {
  await updateDoc(doc(appointmentsCollection(), appointmentId), {
    pacienteNombre: input.pacienteNombre,
    pacienteTelefono: input.pacienteTelefono,
    profesionalUid: input.profesionalUid,
    profesionalNombre,
    inicio: input.inicio,
    fin: input.fin,
    motivo: input.motivo,
    estado: input.estado,
    notas: input.notas,
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  });
}

/** Cancelar es un cambio de estado, no un borrado: la agenda conserva su historial. */
export async function cancelarCita(
  appointmentId: string,
  motivoCancelacion: string,
  uid: string,
): Promise<void> {
  const ahora = new Date().toISOString();
  await updateDoc(doc(appointmentsCollection(), appointmentId), {
    estado: "cancelada" satisfies EstadoCita,
    canceladaEn: ahora,
    canceladaPor: uid,
    motivoCancelacion,
    updatedAt: ahora,
    updatedBy: uid,
  });
}

export async function cambiarEstadoCita(
  appointmentId: string,
  estado: EstadoCita,
  uid: string,
): Promise<void> {
  await updateDoc(doc(appointmentsCollection(), appointmentId), {
    estado,
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  });
}

/** Asocia la ficha a una cita agendada sin ella. */
export async function vincularCitaAPaciente(
  appointmentId: string,
  patientId: string,
  uid: string,
): Promise<void> {
  await updateDoc(doc(appointmentsCollection(), appointmentId), {
    patientId,
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  });
}

/** Marca la cita como atendida y la enlaza con la atención que se abrió desde ella. */
export async function vincularCitaAAtencion(
  appointmentId: string,
  visitId: string,
  uid: string,
): Promise<void> {
  await updateDoc(doc(appointmentsCollection(), appointmentId), {
    visitId,
    estado: "atendida" satisfies EstadoCita,
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  });
}
