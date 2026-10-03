import type { Pago, Presupuesto } from "@cident/shared";
import { anularPagoSchema, aCentavos, deCentavos } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAuth } from "../lib/guards.js";

/** Anular un pago nunca lo borra: queda con su motivo y el saldo del presupuesto se restaura. */
export const anularPago = onCall({ region: "southamerica-east1" }, async (request) => {
  const contexto = requireAuth(request);

  const parsed = anularPagoSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  const { patientId, pagoId, motivo } = parsed.data;

  const db = getFirestore();
  const pagoRef = db.collection("patients").doc(patientId).collection("payments").doc(pagoId);

  const pago = await db.runTransaction(async (tx) => {
    const snap = await tx.get(pagoRef);
    if (!snap.exists) throw new HttpsError("not-found", "Pago no encontrado.");
    const datos = snap.data() as Pago;
    if (datos.centroId !== contexto.claims.centroId) {
      throw new HttpsError("permission-denied", "No pertenece a su centro.");
    }
    if (datos.estado === "anulado") {
      throw new HttpsError("failed-precondition", "El pago ya está anulado.");
    }

    const presupuestoRef = datos.budgetId
      ? db.collection("patients").doc(patientId).collection("budgets").doc(datos.budgetId)
      : null;
    const presupuestoSnap = presupuestoRef ? await tx.get(presupuestoRef) : null;

    tx.update(pagoRef, {
      estado: "anulado",
      motivoAnulacion: motivo,
      anuladoAt: new Date().toISOString(),
      anuladoBy: contexto.uid,
    });
    if (presupuestoRef && presupuestoSnap?.exists) {
      const pagado = (presupuestoSnap.data() as Presupuesto).pagado ?? 0;
      tx.update(presupuestoRef, { pagado: deCentavos(Math.max(0, aCentavos(pagado) - aCentavos(datos.monto))) });
    }
    return datos;
  });

  await registrarAuditoria({
    accion: "pago_anulado",
    uid: contexto.uid,
    centroId: pago.centroId,
    entidad: { tipo: "payments", id: pagoId },
    detalle: { patientId, codigoUnico: pago.codigoUnico, monto: pago.monto, motivo },
  });

  return { ok: true };
});
