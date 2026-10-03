import type { PortalPacienteDatos } from "@cident/shared";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../app/firebase";

export const crearEnlacePortal = httpsCallable<{ patientId: string }, { token: string; expiraAt: string }>(
  functions,
  "crearEnlacePortal",
);
export const revocarEnlacePortal = httpsCallable<{ patientId: string }, { ok: boolean; revocados: number }>(
  functions,
  "revocarEnlacePortal",
);
export const verPortalPaciente = httpsCallable<{ token: string }, PortalPacienteDatos>(
  functions,
  "verPortalPaciente",
);

export const urlPortal = (token: string) => `${window.location.origin}/p/${token}`;
