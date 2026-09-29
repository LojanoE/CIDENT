import { loginSchema } from "@cident/shared";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { verifyPassword } from "../lib/argon2.js";
import { registrarAuditoria } from "../lib/auditoria.js";
import { PEPPER_SECRET } from "../lib/pepper.js";
import { calcularBloqueo, estaBloqueado, verificarLimiteIp } from "../lib/rateLimit.js";

const ERROR_GENERICO = "Usuario o contraseña incorrectos.";

/**
 * Hash argon2id dummy usado cuando el usuario no existe, para que el tiempo
 * de respuesta no revele si el nombre de usuario está registrado.
 */
const HASH_DUMMY =
  "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

interface UsuarioDoc {
  centroId: string;
  rol: "admin" | "profesional";
  activo: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
}

export const login = onCall(
  {
    region: "southamerica-east1",
    secrets: [PEPPER_SECRET],
    // La aplicación de App Check (reCAPTCHA Enterprise) requiere configurar
    // primero un sitio en la consola de Firebase — ver docs/runbook F1.
    enforceAppCheck: false,
  },
  async (request) => {
    const parsed = loginSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", ERROR_GENERICO);
    }
    const { usuario, password } = parsed.data;
    const ip = request.rawRequest.ip ?? "unknown";
    const pepper = PEPPER_SECRET.value();

    await verificarLimiteIp(ip);

    const db = getFirestore();
    const usuarioLower = usuario.toLowerCase();
    const usernameSnap = await db.collection("usernames").doc(usuarioLower).get();

    if (!usernameSnap.exists) {
      await verifyPassword(HASH_DUMMY, password, pepper).catch(() => false);
      await registrarAuditoria({
        accion: "login_fallido",
        uid: null,
        centroId: null,
        detalle: { usuario: usuarioLower, motivo: "usuario_no_existe" },
        ip,
      });
      throw new HttpsError("unauthenticated", ERROR_GENERICO);
    }

    const uid = usernameSnap.data()!.uid as string;
    const userRef = db.collection("users").doc(uid);
    const secretRef = db.collection("userSecrets").doc(uid);
    const [userSnap, secretSnap] = await Promise.all([userRef.get(), secretRef.get()]);

    if (!userSnap.exists || !secretSnap.exists) {
      await verifyPassword(HASH_DUMMY, password, pepper).catch(() => false);
      await registrarAuditoria({
        accion: "login_fallido",
        uid,
        centroId: null,
        detalle: { motivo: "documento_incompleto" },
        ip,
      });
      throw new HttpsError("unauthenticated", ERROR_GENERICO);
    }

    const usuarioDoc = userSnap.data() as UsuarioDoc;
    if (!usuarioDoc.activo) {
      await registrarAuditoria({
        accion: "login_fallido",
        uid,
        centroId: usuarioDoc.centroId,
        detalle: { motivo: "cuenta_inactiva" },
        ip,
      });
      throw new HttpsError("unauthenticated", ERROR_GENERICO);
    }
    if (estaBloqueado(usuarioDoc.lockedUntil)) {
      await registrarAuditoria({ accion: "login_bloqueado", uid, centroId: usuarioDoc.centroId, ip });
      throw new HttpsError("resource-exhausted", "Cuenta bloqueada temporalmente. Intenta más tarde.");
    }

    const hashGuardado = secretSnap.data()!.passwordHash as string;
    const valido = await verifyPassword(hashGuardado, password, pepper);

    if (!valido) {
      const failedAttempts = usuarioDoc.failedAttempts + 1;
      await userRef.update({
        failedAttempts,
        lockedUntil: calcularBloqueo(failedAttempts),
        updatedAt: new Date().toISOString(),
      });
      logger.warn("login fallido", { uid, ip });
      await registrarAuditoria({
        accion: "login_fallido",
        uid,
        centroId: usuarioDoc.centroId,
        detalle: { motivo: "password_invalido", failedAttempts },
        ip,
      });
      throw new HttpsError("unauthenticated", ERROR_GENERICO);
    }

    await userRef.update({
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date().toISOString(),
    });

    const auth = getAuth();
    await auth.setCustomUserClaims(uid, { centroId: usuarioDoc.centroId, rol: usuarioDoc.rol });
    const token = await auth.createCustomToken(uid);

    await registrarAuditoria({ accion: "login_exitoso", uid, centroId: usuarioDoc.centroId, ip });

    return { token };
  },
);
