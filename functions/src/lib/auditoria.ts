import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

export type AccionAuditoria =
  | "login_exitoso"
  | "login_fallido"
  | "login_bloqueado"
  | "usuario_creado"
  | "usuario_actualizado"
  | "password_cambiada"
  | "centro_actualizado"
  | "receta_generada"
  | "certificado_generado"
  | "consentimiento_generado"
  | "presupuesto_generado"
  | "pago_registrado"
  | "pago_anulado"
  | "gasto_registrado"
  | "gasto_anulado"
  | "resumen_atencion_generado"
  | "adjunto_subido"
  | "atencion_eliminada"
  | "atencion_anulada"
  | "portal_enlace_creado"
  | "portal_enlace_revocado"
  | "portal_visitado";

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
