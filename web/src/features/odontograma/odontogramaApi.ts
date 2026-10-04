import type {
  Atencion,
  FotoOdontograma,
  HigieneDoc,
  IndicadoresHigiene,
  Odontograma,
  OdontogramaDoc,
  ResultadoCPO,
  TipoOdontograma,
} from "@cident/shared";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, type Firestore } from "firebase/firestore";
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
  copiadoDe?: OdontogramaDoc["copiadoDe"],
): Promise<void> {
  const documento: OdontogramaDoc = {
    centroId,
    patientId,
    visitId,
    tipo,
    dientes,
    ...(copiadoDe ? { copiadoDe } : {}),
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

/**
 * Odontogramas de las atenciones no anuladas del paciente, de la más antigua a la más reciente.
 * Se filtra solo por `centroId` y se ordena en el cliente para no requerir un índice compuesto.
 */
export async function obtenerOdontogramasDelPaciente(
  patientId: string,
  centroId: string,
): Promise<FotoOdontograma[]> {
  const visitas = await getDocs(
    query(collection(db, "patients", patientId, "visits"), where("centroId", "==", centroId)),
  );
  const validas = visitas.docs
    .map((d) => ({ visitId: d.id, fecha: d.get("fecha") as string, estado: d.get("estado") as string }))
    .filter((v) => v.estado !== "anulada" && typeof v.fecha === "string");
  const fotos = await Promise.all(
    validas.map(async (v) => {
      const odo = await obtenerOdontograma(patientId, v.visitId);
      return odo ? { visitId: v.visitId, fecha: v.fecha, dientes: odo.dientes } : null;
    }),
  );
  return fotos
    .filter((f): f is FotoOdontograma => f !== null)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Último odontograma anterior (o del mismo día) a esta atención, para continuarlo. */
export async function obtenerOdontogramaAnterior(
  patientId: string,
  centroId: string,
  visitId: string,
  fecha: string,
): Promise<{ tipo: TipoOdontograma; dientes: Odontograma; visitId: string; fecha: string } | null> {
  const fotos = await obtenerOdontogramasDelPaciente(patientId, centroId);
  const previas = fotos.filter((f) => f.visitId !== visitId && f.fecha <= fecha);
  const ultima = previas[previas.length - 1];
  if (!ultima) return null;
  const doc = await obtenerOdontograma(patientId, ultima.visitId);
  if (!doc) return null;
  return { tipo: doc.tipo, dientes: doc.dientes, visitId: ultima.visitId, fecha: ultima.fecha };
}
