import type { Centro, Cita, CitaPublicaDatos } from "@cident/shared";
import { responderCitaSchema, verCitaPublicaSchema } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { ENLACE_CITA_KEY, verificarTokenCita } from "../lib/enlaceCita.js";
import { ahoraLocal } from "../lib/horaLocal.js";
import { verificarLimiteIp } from "../lib/rateLimit.js";
import { obtenerLogoBuffer } from "../pdf/logo.js";

const NO_VALIDO = "Enlace no válido o vencido.";

const esVigente = (cita: Cita) =>
  (cita.estado === "pendiente" || cita.estado === "confirmada") && cita.inicio > ahoraLocal();

/** Callable PÚBLICA: datos mínimos de una cita a partir de su enlace firmado. */
export const verCitaPublica = onCall(
  { region: "southamerica-east1", secrets: [ENLACE_CITA_KEY] },
  async (request) => {
    await verificarLimiteIp(request.rawRequest.ip ?? "unknown");
    const parsed = verCitaPublicaSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError("not-found", NO_VALIDO);
    const appointmentId = verificarTokenCita(parsed.data.token, ENLACE_CITA_KEY.value());
    if (!appointmentId) throw new HttpsError("not-found", NO_VALIDO);

    const db = getFirestore();
    const citaSnap = await db.collection("appointments").doc(appointmentId).get();
    const cita = citaSnap.data() as Cita | undefined;
    if (!cita) throw new HttpsError("not-found", NO_VALIDO);
    const centro = (await db.collection("centros").doc(cita.centroId).get()).data() as Centro | undefined;
    if (!centro) throw new HttpsError("not-found", NO_VALIDO);

    const logo = await obtenerLogoBuffer(centro);
    const respuesta: CitaPublicaDatos = {
      centro: {
        nombre: centro.nombre,
        telefono: centro.telefono,
        direccion: centro.direccion,
        logoDataUrl: logo ? `data:${centro.logo?.mimeType ?? "image/png"};base64,${logo.toString("base64")}` : null,
      },
      inicio: cita.inicio,
      profesionalNombre: cita.profesionalNombre,
      estado: cita.estado,
      puedeResponder: esVigente(cita),
    };
    return respuesta;
  },
);

/** Callable PÚBLICA: el paciente confirma o cancela su cita desde el enlace del recordatorio. */
export const responderCita = onCall(
  { region: "southamerica-east1", secrets: [ENLACE_CITA_KEY] },
  async (request) => {
    await verificarLimiteIp(request.rawRequest.ip ?? "unknown");
    const parsed = responderCitaSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError("not-found", NO_VALIDO);
    const appointmentId = verificarTokenCita(parsed.data.token, ENLACE_CITA_KEY.value());
    if (!appointmentId) throw new HttpsError("not-found", NO_VALIDO);

    const db = getFirestore();
    const ref = db.collection("appointments").doc(appointmentId);
    const ahora = new Date().toISOString();

    const centroId = await db.runTransaction(async (tx) => {
      const cita = (await tx.get(ref)).data() as Cita | undefined;
      if (!cita) throw new HttpsError("not-found", NO_VALIDO);
      if (!esVigente(cita)) {
        throw new HttpsError("failed-precondition", "Esta cita ya no se puede modificar desde el enlace.");
      }
      if (parsed.data.respuesta === "confirmar") {
        tx.update(ref, {
          estado: "confirmada",
          confirmadaPorPacienteAt: ahora,
          updatedAt: ahora,
          updatedBy: "paciente",
        });
      } else {
        tx.update(ref, {
          estado: "cancelada",
          canceladaEn: ahora,
          canceladaPor: "paciente",
          motivoCancelacion: "Cancelada por el paciente desde el enlace del recordatorio",
          updatedAt: ahora,
          updatedBy: "paciente",
        });
      }
      return cita.centroId;
    });

    await registrarAuditoria({
      accion: parsed.data.respuesta === "confirmar" ? "cita_confirmada_paciente" : "cita_cancelada_paciente",
      uid: null,
      centroId,
      entidad: { tipo: "appointments", id: appointmentId },
      ip: request.rawRequest.ip,
    });
    return { ok: true };
  },
);
