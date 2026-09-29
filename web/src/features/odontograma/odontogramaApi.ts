import type {
  Atencion,
  HigieneDoc,
  IndicadoresHigiene,
  Odontograma,
  OdontogramaDoc,
  ResultadoCPO,
  TipoOdontograma,
} from "@cident/shared";
import { doc, getDoc, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import { db } from "../../app/firebase";

function odontogramaRef(patientId: string, visitId: string, firestore: Firestore = db) {
  return doc(firestore, "patients", patientId, "visits", visitId, "detalle", "odontograma");
}

function higieneRef(patientId: string, visitId: string, firestore: Firestore = db) {
  return doc(firestore, "patients", patientId, "visits", visitId, "detalle", "higiene");
}

export async function obtenerOdontograma(patientId: string, visitId: string): Promise<OdontogramaDoc | null> {
  const snap = await getDoc(odontogramaRef(patientId, visitId));
  return snap.exists() ? (snap.data() as OdontogramaDoc) : null;
}

/** Escritura única del documento completo — nunca por diente/zona individual. */
export async function guardarOdontograma(
  patientId: string,
  visitId: string,
  centroId: string,
  uid: string,
  tipo: TipoOdontograma,
  dientes: Odontograma,
): Promise<void> {
  const documento: OdontogramaDoc = {
    centroId,
    patientId,
    visitId,
    tipo,
    dientes,
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  };
  await setDoc(odontogramaRef(patientId, visitId), documento);
}

export async function obtenerHigiene(patientId: string, visitId: string): Promise<HigieneDoc | null> {
  const snap = await getDoc(higieneRef(patientId, visitId));
  return snap.exists() ? (snap.data() as HigieneDoc) : null;
}

export async function guardarHigiene(
  patientId: string,
  visitId: string,
  centroId: string,
  dientes: HigieneDoc["dientes"],
): Promise<void> {
  const documento: HigieneDoc = { centroId, visitId, dientes };
  await setDoc(higieneRef(patientId, visitId), documento);
}

/** Refleja el CPO y los promedios de higiene calculados en la atención padre. */
export async function actualizarCpoEHigiene(
  patientId: string,
  visitId: string,
  cpo: ResultadoCPO,
  indicadores: IndicadoresHigiene,
): Promise<void> {
  const cambios: Partial<Atencion> = { cpo, indicadores };
  await updateDoc(doc(db, "patients", patientId, "visits", visitId), cambios);
}
