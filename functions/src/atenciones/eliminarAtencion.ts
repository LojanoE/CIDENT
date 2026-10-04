import type { Atencion } from "@cident/shared";
import { eliminarAtencionSchema } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAuth } from "../lib/guards.js";
import { revertirPlanDeVisita } from "../lib/planTratamiento.js";

/**
 * Elimina un borrador junto con su subcolección `detalle` (odontograma).
 *
 * Solo borradores: una atención finalizada es un registro clínico y se anula
 * (`anularAtencion`), no se borra. Tampoco se borra un borrador que ya emitió
 * recetas o certificados, o que tiene adjuntos: quedarían huérfanos en
 * Firestore/Storage. `firestore.rules` prohíbe el delete desde el cliente,
 * así que esta es la única vía.
 */
export const eliminarAtencion = onCall({ region: "southamerica-east1" }, async (request) => {
  const contexto = requireAuth(request);

  const parsed = eliminarAtencionSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Datos inválidos.");
  }
  const { patientId, visitId } = parsed.data;

  const db = getFirestore();
  const pacienteRef = db.collection("patients").doc(patientId);
  const visitaRef = pacienteRef.collection("visits").doc(visitId);

  const visitaSnap = await visitaRef.get();
  if (!visitaSnap.exists) {
    throw new HttpsError("not-found", "Atención no encontrada.");
  }
  const atencion = visitaSnap.data() as Atencion;

  if (atencion.centroId !== contexto.claims.centroId) {
    throw new HttpsError("permission-denied", "No pertenece a su centro.");
  }
  if (atencion.estado !== "draft") {
    throw new HttpsError(
      "failed-precondition",
      "Solo se pueden eliminar borradores. Una atención finalizada se anula.",
    );
  }

  const subcolecciones = await Promise.all(
    ["prescriptions", "certificates", "budgets", "attachments"].map((sub) =>
      pacienteRef.collection(sub).where("visitId", "==", visitId).limit(1).get(),
    ),
  );
  if (subcolecciones.some((snap) => !snap.empty)) {
    throw new HttpsError(
      "failed-precondition",
      "Esta atención ya tiene documentos o adjuntos. Finalízala y anúlala en lugar de eliminarla.",
    );
  }

  // La agenda no debe quedar apuntando a una atención que ya no existe.
  const citas = await db.collection("appointments").where("visitId", "==", visitId).get();
  const ahora = new Date().toISOString();
  const lote = db.batch();
  for (const cita of citas.docs) {
    if ((cita.data() as { centroId?: string }).centroId !== atencion.centroId) continue;
    lote.update(cita.ref, {
      visitId: null,
      estado: "pendiente",
      updatedAt: ahora,
      updatedBy: contexto.uid,
    });
  }
  await lote.commit();

  const tratamientosRevertidos = await revertirPlanDeVisita(patientId, visitId, atencion.centroId);

  await db.recursiveDelete(visitaRef);

  await registrarAuditoria({
    accion: "atencion_eliminada",
    uid: contexto.uid,
    centroId: atencion.centroId,
    entidad: { tipo: "visits", id: visitId },
    detalle: { patientId, fecha: atencion.fecha, citasDesvinculadas: citas.size, tratamientosRevertidos },
  });

  return { ok: true };
});
