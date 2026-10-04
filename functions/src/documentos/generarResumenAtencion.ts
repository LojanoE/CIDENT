import type { Atencion, Centro, ItemPlan, OdontogramaDoc, Paciente, Usuario } from "@cident/shared";
import { generarResumenAtencionSchema } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAuth } from "../lib/guards.js";
import { obtenerFirmaBuffer } from "../pdf/firma.js";
import { obtenerLogoBuffer } from "../pdf/logo.js";
import { generarPdfResumenAtencion } from "../pdf/atencion.js";

export const generarResumenAtencion = onCall({ region: "southamerica-east1" }, async (request) => {
  const contexto = requireAuth(request);

  const parsed = generarResumenAtencionSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Datos inválidos.");
  }
  const { patientId, visitId } = parsed.data;

  const db = getFirestore();
  const pacienteRef = db.collection("patients").doc(patientId);
  const visitaRef = pacienteRef.collection("visits").doc(visitId);
  const odontogramaRef = visitaRef.collection("detalle").doc("odontograma");

  const [pacienteSnap, visitaSnap, odontogramaSnap] = await Promise.all([
    pacienteRef.get(),
    visitaRef.get(),
    odontogramaRef.get(),
  ]);
  if (!pacienteSnap.exists || !visitaSnap.exists) {
    throw new HttpsError("not-found", "Paciente o visita no encontrados.");
  }
  const paciente = pacienteSnap.data() as Paciente;
  const atencion = visitaSnap.data() as Atencion;
  const odontograma = odontogramaSnap.exists ? (odontogramaSnap.data() as OdontogramaDoc) : null;
  if (atencion.estado === "anulada") {
    throw new HttpsError("failed-precondition", "La atención está anulada.");
  }

  const realizadosSnap = await pacienteRef
    .collection("planTratamiento")
    .where("realizado.visitId", "==", visitId)
    .get();
  const tratamientosRealizados = realizadosSnap.docs
    .map((d) => d.data() as ItemPlan)
    .filter((i) => i.centroId === atencion.centroId)
    .sort((a, b) => a.orden - b.orden)
    .map((i) => {
      const base = i.pieza ? `${i.tratamiento} (pieza ${i.pieza})` : i.tratamiento;
      return i.realizado?.nota ? `${base} — ${i.realizado.nota}` : base;
    });

  const esAdmin = contexto.claims.rol === "admin";
  if (!esAdmin && paciente.centroId !== contexto.claims.centroId) {
    throw new HttpsError("permission-denied", "No pertenece a su centro.");
  }
  if (atencion.centroId !== paciente.centroId) {
    throw new HttpsError("failed-precondition", "La visita no corresponde al paciente.");
  }

  const [usuarioSnap, centroSnap] = await Promise.all([
    db.collection("users").doc(contexto.uid).get(),
    db.collection("centros").doc(paciente.centroId).get(),
  ]);
  if (!usuarioSnap.exists || !centroSnap.exists) {
    throw new HttpsError("failed-precondition", "Profesional o centro no encontrados.");
  }
  const usuario = usuarioSnap.data() as Usuario;
  const centro = centroSnap.data() as Centro;

  const storagePath = `centros/${paciente.centroId}/pacientes/${patientId}/atenciones/Atencion_${visitId}_${atencion.fecha}.pdf`;

  const [firma, logo] = await Promise.all([obtenerFirmaBuffer(), obtenerLogoBuffer(centro)]);
  const pdf = await generarPdfResumenAtencion({
    centro,
    profesional: { nombreCompleto: usuario.nombreCompleto, registroProfesional: usuario.registroProfesional },
    paciente,
    atencion,
    odontograma,
    tratamientosRealizados,
    firma,
    logo,
  });
  await getStorage().bucket().file(storagePath).save(pdf, { contentType: "application/pdf" });

  await registrarAuditoria({
    accion: "resumen_atencion_generado",
    uid: contexto.uid,
    centroId: paciente.centroId,
    entidad: { tipo: "visits", id: visitId },
    detalle: { patientId },
  });

  return { storagePath };
});
