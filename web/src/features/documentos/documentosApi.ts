import type {
  Certificado,
  GenerarCertificadoInput,
  GenerarRecetaInput,
  GenerarResumenAtencionInput,
  Receta,
} from "@cident/shared";
import { collection, type Firestore } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../app/firebase";

export function recetasCollection(patientId: string, firestore: Firestore = db) {
  return collection(firestore, "patients", patientId, "prescriptions");
}

export function certificadosCollection(patientId: string, firestore: Firestore = db) {
  return collection(firestore, "patients", patientId, "certificates");
}

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

export type { Certificado, Receta };
