import type {
  Centro,
  Cita,
  EnlacePortal,
  ItemPlan,
  OdontogramaDoc,
  Paciente,
  PortalPacienteDatos,
  Presupuesto,
} from "@cident/shared";
import { enlaceVigente, planSinMontos, planTratamientoParaPortal, verPortalSchema } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { verificarLimiteIp } from "../lib/rateLimit.js";
import { obtenerLogoBuffer } from "../pdf/logo.js";
import { hashToken } from "./enlaces.js";

const NO_VALIDO = "Enlace no válido o vencido.";

/** Hora de pared local ('YYYY-MM-DDTHH:MM') en la zona del centro (Ecuador). */
function ahoraLocal(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date())
    .replace(" ", "T");
}

/** Callable PÚBLICA (sin sesión): devuelve un DTO mínimo, jamás montos ni datos personales sensibles. */
export const verPortalPaciente = onCall({ region: "southamerica-east1" }, async (request) => {
  await verificarLimiteIp(request.rawRequest.ip ?? "unknown");

  const parsed = verPortalSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("not-found", NO_VALIDO);

  const db = getFirestore();
  const enlaceSnap = await db.collection("portalLinks").doc(hashToken(parsed.data.token)).get();
  const enlace = enlaceSnap.data() as EnlacePortal | undefined;
  if (!enlace || !enlaceVigente(enlace)) throw new HttpsError("not-found", NO_VALIDO);

  const { centroId, patientId } = enlace;
  const pacienteRef = db.collection("patients").doc(patientId);
  const [centroSnap, pacienteSnap] = await Promise.all([
    db.collection("centros").doc(centroId).get(),
    pacienteRef.get(),
  ]);
  const centro = centroSnap.data() as Centro | undefined;
  const paciente = pacienteSnap.data() as Paciente | undefined;
  if (!centro || !paciente || paciente.centroId !== centroId) {
    throw new HttpsError("not-found", NO_VALIDO);
  }

  // Último odontograma de una atención no anulada.
  let odontograma: PortalPacienteDatos["odontograma"] = null;
  const visitas = await pacienteRef.collection("visits").orderBy("fecha", "desc").limit(10).get();
  for (const v of visitas.docs) {
    if (v.get("estado") === "anulada") continue;
    const odo = await v.ref.collection("detalle").doc("odontograma").get();
    if (!odo.exists) continue;
    const datos = odo.data() as OdontogramaDoc;
    odontograma = { tipo: datos.tipo, dientes: datos.dientes, fecha: v.get("fecha") as string };
    break;
  }

  // Plan: el plan de tratamiento del paciente (con lo ya realizado); si no hay, el último
  // presupuesto pendiente o aceptado. Nunca montos.
  const planSnap = await pacienteRef.collection("planTratamiento").where("centroId", "==", centroId).get();
  const planPropio = planTratamientoParaPortal(
    planSnap.docs.map((d) => d.data() as ItemPlan),
    new Date().toISOString().slice(0, 10),
  );
  const presupuestos = await pacienteRef.collection("budgets").orderBy("fecha", "desc").limit(10).get();
  const presupuesto = presupuestos.docs
    .map((d) => d.data() as Presupuesto)
    .find((p) => p.estado === "pendiente" || p.estado === "aceptado");
  const plan = planPropio ?? (presupuesto ? planSinMontos(presupuesto) : null);

  // Próximas citas.
  const citasSnap = await db
    .collection("appointments")
    .where("patientId", "==", patientId)
    .where("inicio", ">=", ahoraLocal())
    .orderBy("inicio")
    .limit(15)
    .get();
  const citas = citasSnap.docs
    .map((d) => d.data() as Cita)
    .filter((c) => c.centroId === centroId && (c.estado === "pendiente" || c.estado === "confirmada"))
    .slice(0, 5)
    .map((c) => ({ inicio: c.inicio, profesionalNombre: c.profesionalNombre, motivo: c.motivo }));

  const logo = await obtenerLogoBuffer(centro);
  const logoDataUrl = logo
    ? `data:${centro.logo?.mimeType ?? "image/png"};base64,${logo.toString("base64")}`
    : null;

  await registrarAuditoria({
    accion: "portal_visitado",
    uid: null,
    centroId,
    entidad: { tipo: "patients", id: patientId },
    ip: request.rawRequest.ip,
  });

  const respuesta: PortalPacienteDatos = {
    centro: { nombre: centro.nombre, telefono: centro.telefono, direccion: centro.direccion, logoDataUrl },
    paciente: { nombre: paciente.nombres.trim().split(/\s+/)[0] ?? "" },
    odontograma,
    plan,
    citas,
  };
  return respuesta;
});
