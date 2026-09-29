import type { Paciente, PacienteInput } from "@cident/shared";
import {
  collection,
  doc,
  getDoc,
  runTransaction,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { db } from "../../app/firebase";

function claveCedula(centroId: string, cedula: string): string {
  return `${centroId}_${cedula}`;
}

/**
 * Crea un paciente en una transacción que también reserva
 * `patientIds/{centroId}_{cedula}`: las reglas de Firestore exigen que ambos
 * documentos se creen con `centroId` coherente, y la propia transacción
 * garantiza la unicidad de cédula por centro (lee antes de escribir).
 */
export async function crearPaciente(
  input: PacienteInput,
  centroId: string,
  uid: string,
): Promise<string> {
  const pacienteRef = doc(collection(db, "patients"));
  const patientId = pacienteRef.id;
  const claveRef = doc(db, "patientIds", claveCedula(centroId, input.cedula));

  await runTransaction(db, async (tx) => {
    const claveSnap = await tx.get(claveRef);
    if (claveSnap.exists()) {
      throw new Error("Ya existe un paciente con esa cédula en este centro.");
    }

    const ahora = new Date().toISOString();
    tx.set(claveRef, { centroId, cedula: input.cedula, patientId });
    tx.set(pacienteRef, {
      patientId,
      centroId,
      cedula: input.cedula,
      nombres: input.nombres,
      apellidos: input.apellidos,
      nombresLower: input.nombres.trim().toLowerCase(),
      apellidosLower: input.apellidos.trim().toLowerCase(),
      sexo: input.sexo,
      fechaNacimiento: input.fechaNacimiento,
      telefono: input.telefono,
      direccion: input.direccion,
      email: input.email,
      alergias: input.alergias,
      createdAt: ahora,
      updatedAt: ahora,
      createdBy: uid,
    } satisfies Paciente);
  });

  return patientId;
}

/** Búsqueda por cédula en una sola lectura, vía el índice `patientIds`. */
export async function buscarPorCedula(
  centroId: string,
  cedula: string,
): Promise<Paciente | null> {
  const claveSnap = await getDoc(doc(db, "patientIds", claveCedula(centroId, cedula)));
  if (!claveSnap.exists()) return null;

  const { patientId } = claveSnap.data() as { patientId: string };
  const pacienteSnap = await getDoc(doc(db, "patients", patientId));
  return pacienteSnap.exists() ? (pacienteSnap.data() as Paciente) : null;
}

export async function obtenerPaciente(patientId: string): Promise<Paciente | null> {
  const snap = await getDoc(doc(db, "patients", patientId));
  return snap.exists() ? (snap.data() as Paciente) : null;
}

/**
 * Actualiza datos de un paciente. La cédula no es editable aquí: cambiarla
 * implicaría mover también `patientIds/{centroId}_{cedula}`, cuya escritura
 * de `update`/`delete` las reglas reservan al admin.
 */
export async function actualizarPaciente(
  patientId: string,
  cambios: Omit<PacienteInput, "cedula">,
): Promise<void> {
  await updateDoc(doc(db, "patients", patientId), {
    ...cambios,
    nombresLower: cambios.nombres.trim().toLowerCase(),
    apellidosLower: cambios.apellidos.trim().toLowerCase(),
    updatedAt: new Date().toISOString(),
  });
}

export function pacientesCollection(firestore: Firestore = db) {
  return collection(firestore, "patients");
}
