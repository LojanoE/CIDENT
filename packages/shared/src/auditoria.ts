/** Acciones que registra `registrarAuditoria` en `auditLogs`. */
export const ACCIONES_AUDITORIA = [
  "login_exitoso",
  "login_fallido",
  "login_bloqueado",
  "usuario_creado",
  "usuario_actualizado",
  "password_cambiada",
  "centro_actualizado",
  "receta_generada",
  "certificado_generado",
  "consentimiento_generado",
  "presupuesto_generado",
  "pago_registrado",
  "pago_anulado",
  "gasto_registrado",
  "gasto_anulado",
  "resumen_atencion_generado",
  "adjunto_subido",
  "adjunto_etiquetado",
  "firma_certificado_guardado",
  "firma_certificado_eliminado",
  "firma_manuscrita_guardada",
  "cargo_actualizado",
  "atencion_eliminada",
  "atencion_anulada",
  "portal_enlace_creado",
  "portal_enlace_revocado",
  "portal_visitado",
  "cita_confirmada_paciente",
  "cita_cancelada_paciente",
] as const;
export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];

export type GrupoAuditoria = "Acceso" | "Usuarios y centro" | "Documentos" | "Pagos" | "Atenciones" | "Portal y citas";

export const ETIQUETAS_AUDITORIA: Record<AccionAuditoria, { etiqueta: string; grupo: GrupoAuditoria }> = {
  login_exitoso: { etiqueta: "Inicio de sesión", grupo: "Acceso" },
  login_fallido: { etiqueta: "Inicio de sesión fallido", grupo: "Acceso" },
  login_bloqueado: { etiqueta: "Cuenta bloqueada", grupo: "Acceso" },
  usuario_creado: { etiqueta: "Usuario creado", grupo: "Usuarios y centro" },
  usuario_actualizado: { etiqueta: "Usuario actualizado", grupo: "Usuarios y centro" },
  password_cambiada: { etiqueta: "Contraseña cambiada", grupo: "Usuarios y centro" },
  centro_actualizado: { etiqueta: "Centro actualizado", grupo: "Usuarios y centro" },
  cargo_actualizado: { etiqueta: "Cargo actualizado", grupo: "Usuarios y centro" },
  firma_certificado_guardado: { etiqueta: "Firma electrónica guardada", grupo: "Usuarios y centro" },
  firma_certificado_eliminado: { etiqueta: "Firma electrónica eliminada", grupo: "Usuarios y centro" },
  firma_manuscrita_guardada: { etiqueta: "Firma dibujada guardada", grupo: "Usuarios y centro" },
  receta_generada: { etiqueta: "Receta generada", grupo: "Documentos" },
  certificado_generado: { etiqueta: "Certificado generado", grupo: "Documentos" },
  consentimiento_generado: { etiqueta: "Consentimiento generado", grupo: "Documentos" },
  presupuesto_generado: { etiqueta: "Presupuesto generado", grupo: "Documentos" },
  resumen_atencion_generado: { etiqueta: "Resumen de atención generado", grupo: "Documentos" },
  adjunto_subido: { etiqueta: "Adjunto subido", grupo: "Documentos" },
  adjunto_etiquetado: { etiqueta: "Adjunto etiquetado", grupo: "Documentos" },
  pago_registrado: { etiqueta: "Pago registrado", grupo: "Pagos" },
  pago_anulado: { etiqueta: "Pago anulado", grupo: "Pagos" },
  gasto_registrado: { etiqueta: "Gasto registrado", grupo: "Pagos" },
  gasto_anulado: { etiqueta: "Gasto anulado", grupo: "Pagos" },
  atencion_eliminada: { etiqueta: "Atención eliminada", grupo: "Atenciones" },
  atencion_anulada: { etiqueta: "Atención anulada", grupo: "Atenciones" },
  portal_enlace_creado: { etiqueta: "Enlace del portal creado", grupo: "Portal y citas" },
  portal_enlace_revocado: { etiqueta: "Enlace del portal revocado", grupo: "Portal y citas" },
  portal_visitado: { etiqueta: "Portal visitado", grupo: "Portal y citas" },
  cita_confirmada_paciente: { etiqueta: "Cita confirmada por el paciente", grupo: "Portal y citas" },
  cita_cancelada_paciente: { etiqueta: "Cita cancelada por el paciente", grupo: "Portal y citas" },
};

/** Etiqueta legible; una acción desconocida (de una versión futura) se muestra tal cual. */
export function etiquetaAuditoria(accion: string): string {
  return (ETIQUETAS_AUDITORIA as Record<string, { etiqueta: string }>)[accion]?.etiqueta ?? accion;
}
