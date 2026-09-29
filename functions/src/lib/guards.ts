import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

export interface Claims {
  centroId: string;
  rol: "admin" | "profesional";
}

export interface Contexto {
  uid: string;
  claims: Claims;
}

export function requireAuth(request: CallableRequest): Contexto {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError("unauthenticated", "Se requiere autenticación.");
  }
  const centroId = auth.token.centroId;
  const rol = auth.token.rol;
  if (typeof centroId !== "string" || (rol !== "admin" && rol !== "profesional")) {
    throw new HttpsError("unauthenticated", "Sesión inválida.");
  }
  return { uid: auth.uid, claims: { centroId, rol } };
}

export function requireAdmin(request: CallableRequest): Contexto {
  const contexto = requireAuth(request);
  if (contexto.claims.rol !== "admin") {
    throw new HttpsError("permission-denied", "Requiere rol admin.");
  }
  return contexto;
}
