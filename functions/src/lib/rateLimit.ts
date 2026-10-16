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

const FIRMA_MAX_FALLOS = 5;
const FIRMA_VENTANA_MS = 15 * 60 * 1000;

/**
 * Freno a la fuerza bruta de la contraseña del .p12: tras `FIRMA_MAX_FALLOS`
 * contraseñas incorrectas seguidas, el usuario espera la ventana completa.
 * `rateLimits/firma_{uid}` no tiene acceso de cliente (ver firestore.rules).
 */
export async function verificarLimiteFirma(uid: string): Promise<void> {
  const snap = await getFirestore().collection("rateLimits").doc(`firma_${uid}`).get();
  const datos = snap.data() as { fallos: number; ventanaInicio: number } | undefined;
  if (datos && Date.now() - datos.ventanaInicio <= FIRMA_VENTANA_MS && datos.fallos >= FIRMA_MAX_FALLOS) {
    throw new HttpsError(
      "resource-exhausted",
      "Demasiados intentos con la contraseña de la firma. Intenta de nuevo en unos minutos.",
    );
  }
}

export async function registrarFalloFirma(uid: string): Promise<void> {
  const db = getFirestore();
  const ref = db.collection("rateLimits").doc(`firma_${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const ahora = Date.now();
    const datos = snap.data() as { fallos: number; ventanaInicio: number } | undefined;
    if (!datos || ahora - datos.ventanaInicio > FIRMA_VENTANA_MS) {
      tx.set(ref, { fallos: 1, ventanaInicio: ahora });
    } else {
      tx.update(ref, { fallos: datos.fallos + 1 });
    }
  });
}

export async function limpiarFallosFirma(uid: string): Promise<void> {
  await getFirestore().collection("rateLimits").doc(`firma_${uid}`).delete().catch(() => undefined);
}
