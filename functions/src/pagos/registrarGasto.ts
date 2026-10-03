import { registrarGastoSchema } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAuth } from "../lib/guards.js";

export const registrarGasto = onCall({ region: "southamerica-east1" }, async (request) => {
  const contexto = requireAuth(request);

  const parsed = registrarGastoSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.issues[0]?.message ?? "Datos de gasto inválidos.");
  }
  const { fecha, monto, categoria, descripcion, formaPago } = parsed.data;
  const centroId = contexto.claims.centroId;

  const ref = getFirestore().collection("centros").doc(centroId).collection("gastos").doc();
  await ref.set({
    id: ref.id,
    centroId,
    fecha,
    monto,
    categoria,
    descripcion,
    formaPago,
    estado: "vigente",
    registradoPor: contexto.uid,
    createdAt: new Date().toISOString(),
  });

  await registrarAuditoria({
    accion: "gasto_registrado",
    uid: contexto.uid,
    centroId,
    entidad: { tipo: "gastos", id: ref.id },
    detalle: { monto, categoria, fecha },
  });

  return { id: ref.id };
});
