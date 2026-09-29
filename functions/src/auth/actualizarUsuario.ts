import { actualizarUsuarioSchema } from "@cident/shared";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { hashPassword } from "../lib/argon2.js";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAdmin } from "../lib/guards.js";
import { PEPPER_SECRET } from "../lib/pepper.js";

export const actualizarUsuario = onCall(
  { region: "southamerica-east1", secrets: [PEPPER_SECRET] },
  async (request) => {
    const contexto = requireAdmin(request);

    const parsed = actualizarUsuarioSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Datos inválidos.");
    }
    const { uid, centroId, rol, nombreCompleto, registroProfesional, activo, passwordNueva } = parsed.data;

    const db = getFirestore();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "Usuario no encontrado.");
    }

    const auth = getAuth();
    const cambiaClaims = centroId !== undefined || rol !== undefined;

    const actualizacion: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (centroId !== undefined) actualizacion.centroId = centroId;
    if (rol !== undefined) actualizacion.rol = rol;
    if (nombreCompleto !== undefined) actualizacion.nombreCompleto = nombreCompleto;
    if (registroProfesional !== undefined) actualizacion.registroProfesional = registroProfesional;
    if (activo !== undefined) actualizacion.activo = activo;

    await userRef.update(actualizacion);

    if (passwordNueva !== undefined) {
      const nuevoHash = await hashPassword(passwordNueva, PEPPER_SECRET.value());
      await db.collection("userSecrets").doc(uid).update({ passwordHash: nuevoHash });
    }

    if (cambiaClaims) {
      const datosFinales = userSnap.data()!;
      await auth.setCustomUserClaims(uid, {
        centroId: centroId ?? datosFinales.centroId,
        rol: rol ?? datosFinales.rol,
      });
      await auth.revokeRefreshTokens(uid);
    }

    // No dependemos de 'activo' en los claims (tardarían hasta 1h en refrescarse):
    // deshabilitamos el usuario directamente en Firebase Auth.
    if (activo !== undefined) {
      await auth.updateUser(uid, { disabled: !activo });
      await auth.revokeRefreshTokens(uid);
    }

    await registrarAuditoria({
      accion: "usuario_actualizado",
      uid: contexto.uid,
      centroId: contexto.claims.centroId,
      entidad: { tipo: "users", id: uid },
      detalle: { centroId, rol, activo, passwordCambiada: passwordNueva !== undefined },
    });

    return { ok: true };
  },
);
