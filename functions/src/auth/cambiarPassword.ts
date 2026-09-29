import { z } from "zod";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { hashPassword, verifyPassword } from "../lib/argon2.js";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAuth } from "../lib/guards.js";
import { PEPPER_SECRET } from "../lib/pepper.js";

const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1).max(200),
  passwordNueva: z.string().min(8).max(200),
});

export const cambiarPassword = onCall(
  { region: "southamerica-east1", secrets: [PEPPER_SECRET] },
  async (request) => {
    const { uid, claims } = requireAuth(request);

    const parsed = cambiarPasswordSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "Datos inválidos.");
    }
    const { passwordActual, passwordNueva } = parsed.data;
    const pepper = PEPPER_SECRET.value();

    const db = getFirestore();
    const secretRef = db.collection("userSecrets").doc(uid);
    const secretSnap = await secretRef.get();
    if (!secretSnap.exists) {
      throw new HttpsError("not-found", "Usuario no encontrado.");
    }

    const hashActual = secretSnap.data()!.passwordHash as string;
    const valido = await verifyPassword(hashActual, passwordActual, pepper);
    if (!valido) {
      throw new HttpsError("unauthenticated", "La contraseña actual es incorrecta.");
    }

    const nuevoHash = await hashPassword(passwordNueva, pepper);
    await secretRef.update({ passwordHash: nuevoHash });

    await registrarAuditoria({ accion: "password_cambiada", uid, centroId: claims.centroId });

    return { ok: true };
  },
);
