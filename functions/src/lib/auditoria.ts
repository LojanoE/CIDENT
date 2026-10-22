import { getFirestore } from "firebase-admin/firestore";
import type { AccionAuditoria } from "@cident/shared";
import * as logger from "firebase-functions/logger";

export type { AccionAuditoria };

export interface RegistrarAuditoriaParams {
  accion: AccionAuditoria;
  uid: string | null;
  centroId: string | null;
  entidad?: { tipo: string; id: string };
  detalle?: Record<string, unknown>;
  ip?: string;
}

/**
 * Registra un evento en `auditLogs` (append-only, solo lectura de admin vía
 * firestore.rules). Nunca lanza: un fallo al auditar no debe romper el flujo
 * clínico o de autenticación que la origina.
 */
export async function registrarAuditoria(params: RegistrarAuditoriaParams): Promise<void> {
  try {
    const db = getFirestore();
    await db.collection("auditLogs").add({
      ...params,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("No se pudo registrar auditoría", { params, err });
  }
}
