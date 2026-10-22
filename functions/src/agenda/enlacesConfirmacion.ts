import { enlacesConfirmacionSchema } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { ENLACE_CITA_KEY, firmarCita } from "../lib/enlaceCita.js";
import { requireAuth } from "../lib/guards.js";

/** Tokens de confirmación para las citas del centro del usuario (los demás ids se ignoran). */
export const enlacesConfirmacionCita = onCall(
  { region: "southamerica-east1", secrets: [ENLACE_CITA_KEY] },
  async (request) => {
    const contexto = requireAuth(request);
    const parsed = enlacesConfirmacionSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const db = getFirestore();
    const refs = parsed.data.appointmentIds.map((id) => db.collection("appointments").doc(id));
    const snaps = await db.getAll(...refs);
    const clave = ENLACE_CITA_KEY.value();

    const tokens: Record<string, string> = {};
    for (const snap of snaps) {
      if (snap.exists && snap.get("centroId") === contexto.claims.centroId) {
        tokens[snap.id] = firmarCita(snap.id, clave);
      }
    }
    return { tokens };
  },
);
