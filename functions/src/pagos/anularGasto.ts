import type { Gasto } from "@cident/shared";
import { anularGastoSchema } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAuth } from "../lib/guards.js";

/** Anular un gasto nunca lo borra: queda con su motivo y deja de contar en la caja. */
export const anularGasto = onCall({ region: "southamerica-east1" }, async (request) => {
  const contexto = requireAuth(request);

  const parsed = anularGastoSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  const { gastoId, motivo } = parsed.data;
  const centroId = contexto.claims.centroId;

  const ref = getFirestore().collection("centros").doc(centroId).collection("gastos").doc(gastoId);
  const gasto = await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Gasto no encontrado.");
    const datos = snap.data() as Gasto;
    if (datos.estado === "anulado") throw new HttpsError("failed-precondition", "El gasto ya está anulado.");
    tx.update(ref, {
      estado: "anulado",
      motivoAnulacion: motivo,
      anuladoAt: new Date().toISOString(),
      anuladoBy: contexto.uid,
    });
    return datos;
  });

  await registrarAuditoria({
    accion: "gasto_anulado",
    uid: contexto.uid,
    centroId,
    entidad: { tipo: "gastos", id: gastoId },
    detalle: { monto: gasto.monto, categoria: gasto.categoria, motivo },
  });

  return { ok: true };
});
