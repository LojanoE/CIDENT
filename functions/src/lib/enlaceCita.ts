import { createHmac, timingSafeEqual } from "node:crypto";
import { defineSecret } from "firebase-functions/params";

/** Clave con la que se firman los enlaces de confirmación de cita (Secret Manager). */
export const ENLACE_CITA_KEY = defineSecret("ENLACE_CITA_KEY");

const firma = (appointmentId: string, clave: string) =>
  createHmac("sha256", clave).update(appointmentId).digest("base64url");

/** Token sin estado: `appointmentId.HMAC`. No se guarda nada; la cita misma decide si sigue vigente. */
export function firmarCita(appointmentId: string, clave: string): string {
  return `${appointmentId}.${firma(appointmentId, clave)}`;
}

/** Devuelve el `appointmentId` si la firma es válida; `null` en cualquier otro caso. */
export function verificarTokenCita(token: string, clave: string): string | null {
  const punto = token.indexOf(".");
  if (punto <= 0) return null;
  const appointmentId = token.slice(0, punto);
  const recibida = Buffer.from(token.slice(punto + 1));
  const esperada = Buffer.from(firma(appointmentId, clave));
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;
  return appointmentId;
}
