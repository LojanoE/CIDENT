import { randomBytes } from "node:crypto";
import type { EnlacePortal } from "@cident/shared";
import { crearEnlacePortalSchema, expiracionPortal } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAuth } from "../lib/guards.js";
import { hashToken, revocarActivos } from "./enlaces.js";

/** Genera un enlace nuevo (revocando los anteriores). El token solo se devuelve aquí. */
export const crearEnlacePortal = onCall({ region: "southamerica-east1" }, async (request) => {
  const contexto = requireAuth(request);
  const parsed = crearEnlacePortalSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  const { patientId } = parsed.data;
  const centroId = contexto.claims.centroId;

  const db = getFirestore();
  const paciente = await db.collection("patients").doc(patientId).get();
  if (!paciente.exists || paciente.get("centroId") !== centroId) {
    throw new HttpsError("not-found", "Paciente no encontrado.");
  }

  await revocarActivos(db, centroId, patientId);

  const token = randomBytes(32).toString("base64url");
  const ahora = new Date();
  const enlace: EnlacePortal = {
    centroId,
    patientId,
    creadoPor: contexto.uid,
    creadoAt: ahora.toISOString(),
    expiraAt: expiracionPortal(ahora),
    revocado: false,
  };
  await db.collection("portalLinks").doc(hashToken(token)).set(enlace);

  await registrarAuditoria({
    accion: "portal_enlace_creado",
    uid: contexto.uid,
    centroId,
    entidad: { tipo: "patients", id: patientId },
    detalle: { expiraAt: enlace.expiraAt },
  });

  return { token, expiraAt: enlace.expiraAt };
});
