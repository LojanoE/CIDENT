import type { Atencion } from "@cident/shared";
import { anularAtencionSchema } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAdmin } from "../lib/guards.js";

/**
 * Anula una atención finalizada. No borra nada: la atención queda visible,
 * en solo lectura y con el motivo, para conservar el historial clínico.
 * Solo admin, y solo dentro de su propio centro.
 */
export const anularAtencion = onCall({ region: "southamerica-east1" }, async (request) => {
  const contexto = requireAdmin(request);

  const parsed = anularAtencionSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  const { patientId, visitId, motivo } = parsed.data;

  const visitaRef = getFirestore().collection("patients").doc(patientId).collection("visits").doc(visitId);
  const visitaSnap = await visitaRef.get();
  if (!visitaSnap.exists) {
    throw new HttpsError("not-found", "Atención no encontrada.");
  }
  const atencion = visitaSnap.data() as Atencion;

  if (atencion.centroId !== contexto.claims.centroId) {
    throw new HttpsError("permission-denied", "No pertenece a su centro.");
  }
  if (atencion.estado !== "final") {
    throw new HttpsError("failed-precondition", "Solo se puede anular una atención finalizada.");
  }

  await visitaRef.update({
    estado: "anulada",
    anuladaAt: new Date().toISOString(),
    anuladaBy: contexto.uid,
    motivoAnulacion: motivo,
  });

  await registrarAuditoria({
    accion: "atencion_anulada",
    uid: contexto.uid,
    centroId: atencion.centroId,
    entidad: { tipo: "visits", id: visitId },
    detalle: { patientId, motivo },
  });

  return { ok: true };
});
