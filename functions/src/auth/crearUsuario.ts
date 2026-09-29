import { crearUsuarioSchema } from "@cident/shared";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { hashPassword } from "../lib/argon2.js";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAdmin } from "../lib/guards.js";
import { PEPPER_SECRET } from "../lib/pepper.js";

export const crearUsuario = onCall(
  { region: "southamerica-east1", secrets: [PEPPER_SECRET] },
  async (request) => {
    const contexto = requireAdmin(request);

    const parsed = crearUsuarioSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Datos de usuario inválidos.");
    }
    const { centroId, rol, usuario, password, nombreCompleto, registroProfesional } = parsed.data;
    const usuarioLower = usuario.toLowerCase();

    const db = getFirestore();
    const auth = getAuth();
    const usernameRef = db.collection("usernames").doc(usuarioLower);

    const authUser = await auth.createUser({ disabled: false });
    const uid = authUser.uid;

    try {
      await db.runTransaction(async (tx) => {
        const usernameSnap = await tx.get(usernameRef);
        if (usernameSnap.exists) {
          throw new HttpsError("already-exists", "El nombre de usuario ya existe.");
        }

        const ahora = new Date().toISOString();
        tx.set(usernameRef, { uid });
        tx.set(db.collection("users").doc(uid), {
          uid,
          centroId,
          rol,
          usuario: usuarioLower,
          nombreCompleto,
          registroProfesional,
          activo: true,
          failedAttempts: 0,
          lockedUntil: null,
          createdAt: ahora,
          updatedAt: ahora,
        });
        tx.set(db.collection("userSecrets").doc(uid), {
          passwordHash: null,
        });
      });
    } catch (err) {
      await auth.deleteUser(uid).catch(() => undefined);
      throw err;
    }

    const passwordHash = await hashPassword(password, PEPPER_SECRET.value());
    await db.collection("userSecrets").doc(uid).update({ passwordHash });
    await auth.setCustomUserClaims(uid, { centroId, rol });

    await registrarAuditoria({
      accion: "usuario_creado",
      uid: contexto.uid,
      centroId: contexto.claims.centroId,
      entidad: { tipo: "users", id: uid },
      detalle: { centroId, rol, usuario: usuarioLower },
    });

    return { uid };
  },
);
