import { revocarEnlacePortalSchema } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAuth } from "../lib/guards.js";
import { revocarActivos } from "./enlaces.js";

export const revocarEnlacePortal = onCall({ region: "southamerica-east1" }, async (request) => {
  const contexto = requireAuth(request);
  const parsed = revocarEnlacePortalSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  const { patientId } = parsed.data;
  const centroId = contexto.claims.centroId;

  const revocados = await revocarActivos(getFirestore(), centroId, patientId);

  await registrarAuditoria({
    accion: "portal_enlace_revocado",
    uid: contexto.uid,
    centroId,
    entidad: { tipo: "patients", id: patientId },
    detalle: { revocados },
  });
  return { ok: true, revocados };
});
