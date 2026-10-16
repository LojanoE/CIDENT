import { etiquetarAdjuntoSchema, FDI_PERMANENTES, FDI_TEMPORALES, type Adjunto } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAuth } from "../lib/guards.js";

const FDI_VALIDAS = new Set<number>([...FDI_PERMANENTES, ...FDI_TEMPORALES]);

/**
 * Corrige el tipo de toma y las piezas de un adjunto. Los `attachments` son de
 * solo lectura para el cliente (`firestore.rules`), así que la edición pasa por aquí.
 */
export const etiquetarAdjunto = onCall({ region: "southamerica-east1" }, async (request) => {
  const { uid, claims } = requireAuth(request);

  const parsed = etiquetarAdjuntoSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Datos inválidos.");
  }
  const { patientId, adjuntoId, toma, piezas } = parsed.data;
  if (piezas.some((p) => !FDI_VALIDAS.has(p))) {
    throw new HttpsError("invalid-argument", "Hay piezas dentales inválidas.");
  }

  const ref = getFirestore().collection("patients").doc(patientId).collection("attachments").doc(adjuntoId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Adjunto no encontrado.");
  }
  const adjunto = snap.data() as Adjunto;
  if (adjunto.centroId !== claims.centroId) {
    throw new HttpsError("permission-denied", "No tienes acceso a este adjunto.");
  }

  const piezasUnicas = [...new Set(piezas)].sort((a, b) => a - b);
  await ref.update({ toma, piezas: piezasUnicas });

  await registrarAuditoria({
    accion: "adjunto_etiquetado",
    uid,
    centroId: claims.centroId,
    entidad: { tipo: "attachments", id: adjuntoId },
    detalle: { patientId, toma, piezas: piezasUnicas },
  });
});
