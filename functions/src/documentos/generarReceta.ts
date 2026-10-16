import type { Centro, Paciente, Usuario } from "@cident/shared";
import { generarRecetaSchema } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAuth } from "../lib/guards.js";
import { siguienteCodigo } from "../lib/counters.js";
import { FIRMA_KEK } from "../lib/cifrado.js";
import { prepararFirma } from "../firma/prepararFirma.js";
import { obtenerLogoBuffer } from "../pdf/logo.js";
import { generarPdfReceta } from "../pdf/receta.js";

export const generarReceta = onCall({ region: "southamerica-east1", secrets: [FIRMA_KEK] }, async (request) => {
  const contexto = requireAuth(request);

  const parsed = generarRecetaSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Datos de receta inválidos.");
  }
  const { patientId, visitId, diagnostico, indicaciones, medicamentos, recomendaciones } = parsed.data;

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

  // Se resuelve ANTES de crear nada: una contraseña incorrecta no debe dejar registros a medias.
  const firmaPrep = await prepararFirma({
    uid: contexto.uid,
    centro: centro.nombre,
    password: parsed.data.firmaElectronica?.password,
  });

  const docRef = pacienteRef.collection("prescriptions").doc();
  const ahora = new Date().toISOString();

  const codigoUnico = await db.runTransaction(async (tx) => {
    const codigo = await siguienteCodigo(tx, paciente.centroId, "receta");
    const storagePath = `centros/${paciente.centroId}/pacientes/${patientId}/recetas/Receta_${codigo}.pdf`;
    tx.set(docRef, {
      id: docRef.id,
      centroId: paciente.centroId,
      patientId,
      visitId,
      fecha: visita.fecha,
      diagnostico,
      indicaciones,
      medicamentos,
      recomendaciones,
      codigoUnico: codigo,
      archivo: { storagePath, nombre: `Receta_${codigo}.pdf` },
      emitidoPor: contexto.uid,
      firma: firmaPrep.info,
      createdAt: ahora,
    });
    return codigo;
  });

  const storagePath = `centros/${paciente.centroId}/pacientes/${patientId}/recetas/Receta_${codigoUnico}.pdf`;

  try {
    const logo = await obtenerLogoBuffer(centro);
    const pdf = await generarPdfReceta({
      centro,
      profesional: { nombreCompleto: usuario.nombreCompleto, registroProfesional: usuario.registroProfesional },
      paciente,
      receta: { fecha: visita.fecha, diagnostico, indicaciones, medicamentos, recomendaciones, codigoUnico },
      firma: firmaPrep.firma,
      sello: firmaPrep.sello,
      logo,
    });
    await getStorage().bucket().file(storagePath).save(await firmaPrep.firmar(pdf), { contentType: "application/pdf" });
  } catch {
    await docRef.delete().catch(() => undefined);
    throw new HttpsError("internal", "No se pudo generar la receta en PDF.");
  }

  await registrarAuditoria({
    accion: "receta_generada",
    uid: contexto.uid,
    centroId: paciente.centroId,
    entidad: { tipo: "prescriptions", id: docRef.id },
    detalle: { firma: firmaPrep.info.tipo, patientId, visitId, codigoUnico },
  });

  return { id: docRef.id, codigo: codigoUnico, storagePath };
});
