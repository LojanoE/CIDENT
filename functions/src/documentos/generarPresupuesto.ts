import type { Centro, LineaPresupuesto, Paciente, Usuario } from "@cident/shared";
import { calcularTotalesPresupuesto, claveTratamiento, generarPresupuestoSchema } from "@cident/shared";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { siguienteCodigo } from "../lib/counters.js";
import { requireAuth } from "../lib/guards.js";
import { obtenerFirmaBuffer } from "../pdf/firma.js";
import { obtenerLogoBuffer } from "../pdf/logo.js";
import { generarPdfPresupuesto } from "../pdf/presupuesto.js";

export const generarPresupuesto = onCall({ region: "southamerica-east1" }, async (request) => {
  const contexto = requireAuth(request);

  const parsed = generarPresupuestoSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.issues[0]?.message ?? "Datos de presupuesto inválidos.");
  }
  const { patientId, visitId, descuentoPorcentaje, ivaPorcentaje, validezDias, observaciones } = parsed.data;

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
  if (visita.estado !== "draft") {
    throw new HttpsError("failed-precondition", "La atención está finalizada. Reábrela para emitir documentos.");
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

  // Los totales los decide el servidor; lo que calcule el cliente no se usa.
  const totales = calcularTotalesPresupuesto(parsed.data.lineas, descuentoPorcentaje, ivaPorcentaje);
  const lineas: LineaPresupuesto[] = parsed.data.lineas.map((l, i) => ({
    tratamiento: l.tratamiento,
    ...(l.pieza ? { pieza: l.pieza } : {}),
    cantidad: l.cantidad,
    precioUnitario: l.precioUnitario,
    totalLinea: totales.totalesLinea[i] ?? 0,
  }));

  const docRef = pacienteRef.collection("budgets").doc();
  const ahora = new Date().toISOString();

  const codigoUnico = await db.runTransaction(async (tx) => {
    const codigo = await siguienteCodigo(tx, paciente.centroId, "presupuesto");
    tx.set(docRef, {
      id: docRef.id,
      centroId: paciente.centroId,
      patientId,
      visitId,
      fecha: visita.fecha,
      codigoUnico: codigo,
      lineas,
      subtotal: totales.subtotal,
      descuentoPorcentaje,
      descuento: totales.descuento,
      ivaPorcentaje,
      iva: totales.iva,
      total: totales.total,
      validezDias,
      observaciones,
      estado: "pendiente",
      archivo: {
        storagePath: `centros/${paciente.centroId}/pacientes/${patientId}/presupuestos/Presupuesto_${codigo}.pdf`,
        nombre: `Presupuesto_${codigo}.pdf`,
      },
      emitidoPor: contexto.uid,
      createdAt: ahora,
    });
    return codigo;
  });

  const storagePath = `centros/${paciente.centroId}/pacientes/${patientId}/presupuestos/Presupuesto_${codigoUnico}.pdf`;

  try {
    const [firma, logo] = await Promise.all([obtenerFirmaBuffer(), obtenerLogoBuffer(centro)]);
    const pdf = await generarPdfPresupuesto({
      centro,
      profesional: { nombreCompleto: usuario.nombreCompleto, registroProfesional: usuario.registroProfesional },
      paciente,
      presupuesto: {
        fecha: visita.fecha,
        codigoUnico,
        lineas,
        subtotal: totales.subtotal,
        descuentoPorcentaje,
        descuento: totales.descuento,
        ivaPorcentaje,
        iva: totales.iva,
        total: totales.total,
        validezDias,
        observaciones,
      },
      firma,
      logo,
    });
    await getStorage().bucket().file(storagePath).save(pdf, { contentType: "application/pdf" });
  } catch {
    await docRef.delete().catch(() => undefined);
    throw new HttpsError("internal", "No se pudo generar el presupuesto en PDF.");
  }

  // Catálogo del centro: cada tratamiento queda guardado con su último precio para el próximo
  // presupuesto. Es una comodidad; si falla, el presupuesto ya está emitido.
  try {
    const batch = db.batch();
    const vistos = new Set<string>();
    for (const l of lineas) {
      const clave = claveTratamiento(l.tratamiento);
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);
      batch.set(
        db.collection("centros").doc(paciente.centroId).collection("tratamientos").doc(clave),
        { nombre: l.tratamiento, precioUnitario: l.precioUnitario, usos: FieldValue.increment(1), updatedAt: ahora },
        { merge: true },
      );
    }
    batch.set(db.collection("centros").doc(paciente.centroId), { presupuestoIva: ivaPorcentaje }, { merge: true });
    await batch.commit();
  } catch (err) {
    logger.error("No se pudo actualizar el catálogo de tratamientos", { err });
  }

  await registrarAuditoria({
    accion: "presupuesto_generado",
    uid: contexto.uid,
    centroId: paciente.centroId,
    entidad: { tipo: "budgets", id: docRef.id },
    detalle: { patientId, visitId, codigoUnico, total: totales.total },
  });

  return { id: docRef.id, codigo: codigoUnico, storagePath };
});
