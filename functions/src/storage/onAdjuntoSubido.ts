import type { Adjunto } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as logger from "firebase-functions/logger";
import { registrarAuditoria } from "../lib/auditoria.js";

const RUTA_STAGING = /^uploads\/([^/]+)\/([^/]+)\/(.+)$/;

export const onAdjuntoSubido = onObjectFinalized({ region: "southamerica-east1" }, async (event) => {
  const objeto = event.data;
  const ruta = objeto.name;
  if (!ruta) return;

  const match = RUTA_STAGING.exec(ruta);
  if (!match) return; // no es un objeto de staging (p. ej. un PDF de F5 ya definitivo)

  const [, centroId, uid, nombreArchivo] = match;
  if (!centroId || !uid || !nombreArchivo) return; // grupos siempre presentes si `match` no es null

  const bucket = getStorage().bucket(objeto.bucket);
  const archivoStaging = bucket.file(ruta);

  const limpiarStaging = async () => {
    await archivoStaging.delete().catch(() => undefined);
  };

  const patientId = objeto.metadata?.patientId;
  const visitId = objeto.metadata?.visitId;
  if (!patientId || !visitId) {
    logger.error("Adjunto sin patientId/visitId en customMetadata", { ruta });
    await limpiarStaging();
    return;
  }

  const db = getFirestore();
  const pacienteRef = db.collection("patients").doc(patientId);
  const visitaRef = pacienteRef.collection("visits").doc(visitId);
  const [pacienteSnap, visitaSnap] = await Promise.all([pacienteRef.get(), visitaRef.get()]);

  if (!pacienteSnap.exists || !visitaSnap.exists) {
    logger.error("Paciente o visita no encontrados para adjunto", { ruta, patientId, visitId });
    await limpiarStaging();
    return;
  }
  const paciente = pacienteSnap.data() as { centroId: string };
  const visita = visitaSnap.data() as { centroId: string };
  if (paciente.centroId !== centroId || visita.centroId !== centroId) {
    logger.error("centroId de la ruta no coincide con el del paciente/visita", { ruta, patientId, visitId });
    await limpiarStaging();
    return;
  }

  const docRef = pacienteRef.collection("attachments").doc();
  const storagePath = `centros/${centroId}/pacientes/${patientId}/adjuntos/${docRef.id}_${nombreArchivo}`;

  await archivoStaging.move(storagePath);

  const ahora = new Date().toISOString();
  const adjunto: Adjunto = {
    id: docRef.id,
    centroId,
    patientId,
    visitId,
    fecha: ahora.slice(0, 10),
    nombre: nombreArchivo,
    mimeType: objeto.contentType ?? "application/octet-stream",
    size: Number(objeto.size ?? 0),
    archivo: { storagePath },
    uploadedBy: uid,
    createdAt: ahora,
  };
  await docRef.set(adjunto);

  await registrarAuditoria({
    accion: "adjunto_subido",
    uid,
    centroId,
    entidad: { tipo: "attachments", id: docRef.id },
    detalle: { patientId, visitId, nombre: nombreArchivo, size: adjunto.size },
  });
});
