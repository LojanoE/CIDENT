import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

const IP_VENTANA_MS = 15 * 60 * 1000;
const IP_MAX_INTENTOS = 30;

const USUARIO_MAX_INTENTOS = 5;
const USUARIO_BLOQUEO_MS = 15 * 60 * 1000;

/** Límite por IP, en `rateLimits/ip_{ip}` — sin acceso de cliente (ver firestore.rules). */
export async function verificarLimiteIp(ip: string): Promise<void> {
  const db = getFirestore();
  const ref = db.collection("rateLimits").doc(`ip_${ip}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const ahora = Date.now();
    const datos = snap.data() as { intentos: number; ventanaInicio: number } | undefined;

    if (!datos || ahora - datos.ventanaInicio > IP_VENTANA_MS) {
      tx.set(ref, { intentos: 1, ventanaInicio: ahora });
      return;
    }
    if (datos.intentos >= IP_MAX_INTENTOS) {
      throw new HttpsError("resource-exhausted", "Demasiados intentos. Intenta más tarde.");
    }
    tx.update(ref, { intentos: datos.intentos + 1 });
  });
}

export function estaBloqueado(lockedUntil: string | null): boolean {
  return lockedUntil !== null && new Date(lockedUntil).getTime() > Date.now();
}

/** Bloqueo del usuario tras demasiados intentos fallidos consecutivos. */
export function calcularBloqueo(failedAttempts: number): string | null {
  return failedAttempts >= USUARIO_MAX_INTENTOS
    ? new Date(Date.now() + USUARIO_BLOQUEO_MS).toISOString()
    : null;
}
