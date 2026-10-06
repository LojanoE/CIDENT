import { createHash } from "node:crypto";
import type { Centro, Paciente, Usuario } from "@cident/shared";
import { CONSENTIMIENTOS, generarConsentimientoSchema } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { siguienteCodigo } from "../lib/counters.js";
import { requireAuth } from "../lib/guards.js";
import { generarPdfConsentimiento } from "../pdf/consentimiento.js";
import { obtenerFirmaBuffer } from "../pdf/firma.js";
import { obtenerLogoBuffer } from "../pdf/logo.js";

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export const generarConsentimiento = onCall({ region: "southamerica-east1" }, async (request) => {
  const contexto = requireAuth(request);

  const parsed = generarConsentimientoSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.issues[0]?.message ?? "Datos de consentimiento inválidos.");
  }
  const { patientId, visitId, plantilla, tratamiento, pieza, textoFinal, firmaPaciente, firmante } = parsed.data;

  // La firma se valida por su contenido real, no por el prefijo del data URL.
  const firmaBuffer = Buffer.from(firmaPaciente.slice(firmaPaciente.indexOf(",") + 1), "base64");
  if (firmaBuffer.length < FIRMA_PNG.length || !FIRMA_PNG.every((b, i) => firmaBuffer[i] === b)) {
    throw new HttpsError("invalid-argument", "La firma no es una imagen PNG válida.");
  }

  const db = getFirestore();
  const pacienteRef = db.collection("patients").doc(patientId);
  const visitaRef = pacienteRef.collection("visits").doc(visitId);

  const [pacienteSnap, visitaSnap] = await Promise.all([pacienteRef.get(), visitaRef.get()]);
  if (!pacienteSnap.exists || !visitaSnap.exists) {
    throw new HttpsError("not-found", "Paciente o visita no encontrados.");
  }
  const paciente = pacienteSnap.data() as Paciente;
  const visita = visitaSnap.data() as { fecha: string; centroId: string; estado?: string };
  if (visita.estado === "anulada") {
    throw new HttpsError("failed-precondition", "La atención está anulada.");
  }
  if (contexto.claims.centroId !== paciente.centroId) {
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

  const docRef = pacienteRef.collection("consents").doc();
  const ahora = new Date().toISOString();
  const titulo = CONSENTIMIENTOS[plantilla].titulo;
  const hashTexto = createHash("sha256").update(textoFinal, "utf8").digest("hex");
  const nombreArchivo = `Consentimiento_${docRef.id}_${visita.fecha}.pdf`;
  const storagePath = `centros/${paciente.centroId}/pacientes/${patientId}/consentimientos/${nombreArchivo}`;

  const codigoUnico = await db.runTransaction(async (tx) => {
    const codigo = await siguienteCodigo(tx, paciente.centroId, "consentimiento");
    tx.set(docRef, {
      id: docRef.id,
      centroId: paciente.centroId,
      patientId,
      visitId,
      fecha: visita.fecha,
      plantilla,
      titulo,
      tratamiento,
      ...(pieza ? { pieza } : {}),
      firmante,
      hashTexto,
      codigoUnico: codigo,
      archivo: { storagePath, nombre: nombreArchivo },
      emitidoPor: contexto.uid,
      createdAt: ahora,
    });
    return codigo;
  });

  try {
    const [firma, logo] = await Promise.all([obtenerFirmaBuffer(), obtenerLogoBuffer(centro)]);
    const pdf = await generarPdfConsentimiento({
      centro,
      profesional: { nombreCompleto: usuario.nombreCompleto, registroProfesional: usuario.registroProfesional },
      paciente,
      consentimiento: {
        fecha: visita.fecha,
        firmadoAt: ahora,
        titulo,
        texto: textoFinal,
        codigoUnico,
        hashTexto,
        firmante,
      },
      firmaPaciente: firmaBuffer,
      firma,
      logo,
    });
    await getStorage().bucket().file(storagePath).save(pdf, { contentType: "application/pdf" });
  } catch {
    await docRef.delete().catch(() => undefined);
    throw new HttpsError("internal", "No se pudo generar el consentimiento en PDF.");
  }

  await registrarAuditoria({
    accion: "consentimiento_generado",
    uid: contexto.uid,
    centroId: paciente.centroId,
    entidad: { tipo: "consents", id: docRef.id },
    detalle: { patientId, visitId, codigoUnico, plantilla },
  });

  return { id: docRef.id, codigo: codigoUnico, storagePath };
});
