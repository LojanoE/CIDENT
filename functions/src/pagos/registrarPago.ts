import type { Centro, Paciente, Presupuesto, Usuario } from "@cident/shared";
import { aCentavos, deCentavos, registrarPagoSchema } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { siguienteCodigo } from "../lib/counters.js";
import { requireAuth } from "../lib/guards.js";
import { obtenerFirmaBuffer } from "../pdf/firma.js";
import { obtenerLogoBuffer } from "../pdf/logo.js";
import { generarPdfRecibo } from "../pdf/recibo.js";

export const registrarPago = onCall({ region: "southamerica-east1" }, async (request) => {
  const contexto = requireAuth(request);

  const parsed = registrarPagoSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.issues[0]?.message ?? "Datos de pago inválidos.");
  }
  const { patientId, budgetId, monto, formaPago, fecha, referencia } = parsed.data;

  const db = getFirestore();
  const pacienteRef = db.collection("patients").doc(patientId);
  const pacienteSnap = await pacienteRef.get();
  if (!pacienteSnap.exists) throw new HttpsError("not-found", "Paciente no encontrado.");
  const paciente = pacienteSnap.data() as Paciente;
  if (paciente.centroId !== contexto.claims.centroId) {
    throw new HttpsError("permission-denied", "No pertenece a su centro.");
  }
  const centroId = paciente.centroId;

  const presupuestoRef = budgetId ? pacienteRef.collection("budgets").doc(budgetId) : null;
  const pagoRef = pacienteRef.collection("payments").doc();
  const ahora = new Date().toISOString();

  let concepto = parsed.data.concepto ?? "";
  let presupuestoCodigo: string | undefined;
  let saldoDespues: number | undefined;
  let profesionalUid = parsed.data.profesionalUid ?? contexto.uid;

  const codigoUnico = await db.runTransaction(async (tx) => {
    if (presupuestoRef) {
      const snap = await tx.get(presupuestoRef);
      if (!snap.exists) throw new HttpsError("not-found", "Presupuesto no encontrado.");
      const presupuesto = snap.data() as Presupuesto & { emitidoPor?: string };
      if (presupuesto.centroId !== centroId || presupuesto.patientId !== patientId) {
        throw new HttpsError("failed-precondition", "El presupuesto no corresponde al paciente.");
      }
      if (presupuesto.estado !== "aceptado") {
        throw new HttpsError("failed-precondition", "Solo se registran pagos contra presupuestos aceptados.");
      }
      const pagadoCentavos = aCentavos(presupuesto.pagado ?? 0);
      const saldoCentavos = aCentavos(presupuesto.total) - pagadoCentavos;
      if (aCentavos(monto) > saldoCentavos) {
        throw new HttpsError(
          "failed-precondition",
          `El monto excede el saldo pendiente ($ ${deCentavos(saldoCentavos).toFixed(2)}).`,
        );
      }
      presupuestoCodigo = presupuesto.codigoUnico;
      saldoDespues = deCentavos(saldoCentavos - aCentavos(monto));
      concepto = concepto || `Abono a presupuesto ${presupuesto.codigoUnico}`;
      if (!parsed.data.profesionalUid && presupuesto.emitidoPor) profesionalUid = presupuesto.emitidoPor;

      const codigo = await siguienteCodigo(tx, centroId, "recibo");
      tx.update(presupuestoRef, { pagado: deCentavos(pagadoCentavos + aCentavos(monto)) });
      tx.set(pagoRef, armarPago(codigo));
      return codigo;
    }

    const codigo = await siguienteCodigo(tx, centroId, "recibo");
    tx.set(pagoRef, armarPago(codigo));
    return codigo;
  });

  function armarPago(codigo: string) {
    return {
      id: pagoRef.id,
      centroId,
      patientId,
      ...(budgetId ? { budgetId } : {}),
      ...(presupuestoCodigo ? { presupuestoCodigo } : {}),
      concepto,
      fecha,
      monto,
      formaPago,
      ...(referencia ? { referencia } : {}),
      profesionalUid,
      codigoUnico: codigo,
      ...(saldoDespues !== undefined ? { saldoDespues } : {}),
      archivo: {
        storagePath: `centros/${centroId}/pacientes/${patientId}/recibos/Recibo_${codigo}.pdf`,
        nombre: `Recibo_${codigo}.pdf`,
      },
      estado: "vigente",
      registradoPor: contexto.uid,
      createdAt: ahora,
    };
  }

  const storagePath = `centros/${centroId}/pacientes/${patientId}/recibos/Recibo_${codigoUnico}.pdf`;

  try {
    const [centroSnap, profesionalSnap] = await Promise.all([
      db.collection("centros").doc(centroId).get(),
      db.collection("users").doc(profesionalUid).get(),
    ]);
    if (!centroSnap.exists) throw new Error("centro");
    const centro = centroSnap.data() as Centro;
    // El profesional atribuido debe ser del mismo centro; si no, se firma con quien registra.
    let usuario = profesionalSnap.exists ? (profesionalSnap.data() as Usuario) : null;
    if (!usuario || usuario.centroId !== centroId) {
      usuario = (await db.collection("users").doc(contexto.uid).get()).data() as Usuario;
      profesionalUid = contexto.uid;
      await pagoRef.update({ profesionalUid });
    }

    const [firma, logo] = await Promise.all([obtenerFirmaBuffer(), obtenerLogoBuffer(centro)]);
    const pdf = await generarPdfRecibo({
      centro,
      profesional: { nombreCompleto: usuario.nombreCompleto, registroProfesional: usuario.registroProfesional },
      paciente,
      pago: { fecha, codigoUnico, concepto, presupuestoCodigo, monto, formaPago, referencia, saldoDespues },
      firma,
      logo,
    });
    await getStorage().bucket().file(storagePath).save(pdf, { contentType: "application/pdf" });
  } catch {
    // Sin recibo no hay pago: se revierte el cobro y el acumulado del presupuesto.
    await db
      .runTransaction(async (tx) => {
        const pres = presupuestoRef ? await tx.get(presupuestoRef) : null;
        if (presupuestoRef && pres?.exists) {
          const pagado = (pres.data() as Presupuesto).pagado ?? 0;
          tx.update(presupuestoRef, { pagado: deCentavos(Math.max(0, aCentavos(pagado) - aCentavos(monto))) });
        }
        tx.delete(pagoRef);
      })
      .catch(() => undefined);
    throw new HttpsError("internal", "No se pudo generar el recibo en PDF.");
  }

  await registrarAuditoria({
    accion: "pago_registrado",
    uid: contexto.uid,
    centroId,
    entidad: { tipo: "payments", id: pagoRef.id },
    detalle: { patientId, budgetId: budgetId ?? null, codigoUnico, monto, formaPago },
  });

  return { id: pagoRef.id, codigo: codigoUnico, storagePath };
});

