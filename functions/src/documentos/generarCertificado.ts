import type { Centro, Paciente, Usuario } from "@cident/shared";
import { generarCertificadoSchema } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAuth } from "../lib/guards.js";
import { siguienteCodigo } from "../lib/counters.js";
import { obtenerFirmaBuffer } from "../pdf/firma.js";
import { obtenerLogoBuffer } from "../pdf/logo.js";
import { generarPdfCertificado } from "../pdf/certificado.js";

export const generarCertificado = onCall({ region: "southamerica-east1" }, async (request) => {
  const contexto = requireAuth(request);

  const parsed = generarCertificadoSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Datos de certificado inválidos.");
  }
  const { patientId, visitId, motivo, observaciones } = parsed.data;

  const db = getFirestore();
  const pacienteRef = db.collection("patients").doc(patientId);
  const visitaRef = pacienteRef.collection("visits").doc(visitId);

  const [pacienteSnap, visitaSnap] = await Promise.all([pacienteRef.get(), visitaRef.get()]);
  if (!pacienteSnap.exists || !visitaSnap.exists) {
    throw new HttpsError("not-found", "Paciente o visita no encontrados.");
  }
  const paciente = pacienteSnap.data() as Paciente;
  const visita = visitaSnap.data() as { fecha: string; centroId: string };

  const esAdmin = contexto.claims.rol === "admin";
  if (!esAdmin && paciente.centroId !== contexto.claims.centroId) {
    throw new HttpsError("permission-denied", "No pertenece a su centro.");
  }
  if (visita.centroId !== paciente.centroId) {
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

  const docRef = pacienteRef.collection("certificates").doc();
  const ahora = new Date().toISOString();

  const codigoUnico = await db.runTransaction(async (tx) => {
    const codigo = await siguienteCodigo(tx, paciente.centroId, "certificado");
    const storagePath = `centros/${paciente.centroId}/pacientes/${patientId}/certificados/Certificado_${docRef.id}_${visita.fecha}.pdf`;
    tx.set(docRef, {
      id: docRef.id,
      centroId: paciente.centroId,
      patientId,
      visitId,
      fecha: visita.fecha,
      motivo,
      observaciones,
      codigoUnico: codigo,
      archivo: { storagePath, nombre: `Certificado_${docRef.id}_${visita.fecha}.pdf` },
      emitidoPor: contexto.uid,
      createdAt: ahora,
    });
    return codigo;
  });

  const storagePath = `centros/${paciente.centroId}/pacientes/${patientId}/certificados/Certificado_${docRef.id}_${visita.fecha}.pdf`;

  try {
    const [firma, logo] = await Promise.all([obtenerFirmaBuffer(), obtenerLogoBuffer(centro)]);
    const pdf = await generarPdfCertificado({
      centro,
      profesional: { nombreCompleto: usuario.nombreCompleto, registroProfesional: usuario.registroProfesional },
      paciente,
      certificado: { fecha: visita.fecha, motivo, observaciones, codigoUnico },
      firma,
      logo,
    });
    await getStorage().bucket().file(storagePath).save(pdf, { contentType: "application/pdf" });
  } catch {
    await docRef.delete().catch(() => undefined);
    throw new HttpsError("internal", "No se pudo generar el certificado en PDF.");
  }

  await registrarAuditoria({
    accion: "certificado_generado",
    uid: contexto.uid,
    centroId: paciente.centroId,
    entidad: { tipo: "certificates", id: docRef.id },
    detalle: { patientId, visitId, codigoUnico },
  });

  return { id: docRef.id, codigo: codigoUnico, storagePath };
});
