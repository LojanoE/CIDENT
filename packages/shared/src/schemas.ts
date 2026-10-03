import { z } from "zod";
import { CATEGORIAS_GASTO, CONDICIONES, ESTADOS_CITA, FORMAS_PAGO, ZONAS } from "./types.js";

export const cedulaSchema = z
  .string()
  .trim()
  .min(5, "La cédula es demasiado corta")
  .max(20, "La cédula es demasiado larga")
  .regex(/^[0-9A-Za-z-]+$/, "La cédula solo admite números, letras y guiones");

export const fechaIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)");

export const pacienteSchema = z.object({
  cedula: cedulaSchema,
  nombres: z.string().trim().min(1, "Los nombres son obligatorios").max(120),
  apellidos: z.string().trim().min(1, "Los apellidos son obligatorios").max(120),
  sexo: z.enum(["M", "F"]),
  fechaNacimiento: fechaIsoSchema,
  telefono: z.string().trim().max(30).optional().default(""),
  direccion: z.string().trim().max(300).optional().default(""),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")).default(""),
  alergias: z.string().trim().max(500).optional().default(""),
});
export type PacienteInput = z.infer<typeof pacienteSchema>;

export const indicadoresHigieneSchema = z.object({
  placa: z.number().min(0).max(3).default(0),
  calculo: z.number().min(0).max(3).default(0),
  gingivitis: z.number().min(0).max(1).default(0),
});

export const cpoInputSchema = z.object({
  c: z.number().int().min(0).max(32).default(0),
  p: z.number().int().min(0).max(32).default(0),
  o: z.number().int().min(0).max(32).default(0),
});
export type CpoInput = z.infer<typeof cpoInputSchema>;

export const atencionSchema = z.object({
  fecha: fechaIsoSchema,
  motivo: z.string().trim().max(500).default(""),
  problemaActual: z.string().trim().max(2000).default(""),
  antecedentes: z.string().trim().max(2000).default(""),
  signosVitales: z.string().trim().max(500).default(""),
  examenEstomatognatico: z.string().trim().max(2000).default(""),
  indicadores: indicadoresHigieneSchema,
  cpo: cpoInputSchema,
  notas: z.string().trim().max(2000).default(""),
});
export type AtencionInput = z.infer<typeof atencionSchema>;

export const condicionSchema = z.enum(CONDICIONES);
export const zonaSchema = z.enum(ZONAS);

export const estadoZonaSchema = z.object({
  estados: z.array(condicionSchema).max(10),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido")
    .default("#000000"),
  nota: z.string().trim().max(500, "La nota no puede superar 500 caracteres").default(""),
});

export const estadoDienteSchema = z.object({
  general: estadoZonaSchema.optional(),
  zonas: z.record(zonaSchema, estadoZonaSchema).default({}),
});

export const odontogramaSchema = z.object({
  tipo: z.enum(["adulto", "infantil"]),
  dientes: z.record(z.string(), estadoDienteSchema).default({}),
});

export const recetaSchema = z.object({
  diagnostico: z.string().trim().max(1000).default(""),
  indicaciones: z.string().trim().max(2000).default(""),
  medicamentos: z.string().trim().max(2000).default(""),
  recomendaciones: z.string().trim().max(1000).default(""),
});
export type RecetaInput = z.infer<typeof recetaSchema>;

export const certificadoSchema = z.object({
  motivo: z.string().trim().max(500).default(""),
  observaciones: z.string().trim().max(2000).default(""),
});
export type CertificadoInput = z.infer<typeof certificadoSchema>;

// ---------------------------------------------------------------------------
// Generación de documentos PDF (F5)
// ---------------------------------------------------------------------------

const referenciaVisitaSchema = z.object({
  patientId: z.string().trim().min(1),
  visitId: z.string().trim().min(1),
});

export const generarRecetaSchema = recetaSchema.merge(referenciaVisitaSchema);
export type GenerarRecetaInput = z.infer<typeof generarRecetaSchema>;

export const generarCertificadoSchema = certificadoSchema.merge(referenciaVisitaSchema);
export type GenerarCertificadoInput = z.infer<typeof generarCertificadoSchema>;

export const generarResumenAtencionSchema = referenciaVisitaSchema;
export type GenerarResumenAtencionInput = z.infer<typeof generarResumenAtencionSchema>;

// ---------------------------------------------------------------------------
// Presupuestos de tratamientos
// ---------------------------------------------------------------------------

export const lineaPresupuestoSchema = z.object({
  tratamiento: z.string().trim().min(1, "Indica el tratamiento.").max(120),
  pieza: z
    .string()
    .trim()
    .max(20)
    .nullable()
    .optional()
    .transform((v) => (v ? v : undefined)),
  cantidad: z.coerce.number().int("Debe ser un entero.").min(1, "Mínimo 1.").max(999),
  precioUnitario: z.coerce
    .number()
    .min(0, "No puede ser negativo.")
    .max(1_000_000)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "Máximo 2 decimales."),
});

export const presupuestoSchema = z.object({
  lineas: z.array(lineaPresupuestoSchema).min(1, "Agrega al menos un tratamiento.").max(50),
  descuentoPorcentaje: z.coerce.number().min(0).max(100).default(0),
  ivaPorcentaje: z.coerce.number().min(0).max(100).default(0),
  validezDias: z.coerce.number().int().min(1).max(365).default(30),
  observaciones: z.string().trim().max(1000).default(""),
});
export type PresupuestoInput = z.input<typeof presupuestoSchema>;
export type PresupuestoDatos = z.output<typeof presupuestoSchema>;

export const generarPresupuestoSchema = presupuestoSchema.merge(referenciaVisitaSchema);
export type GenerarPresupuestoInput = z.input<typeof generarPresupuestoSchema>;

// ---------------------------------------------------------------------------
// Contabilidad: pagos y gastos
// ---------------------------------------------------------------------------

const montoSchema = z.coerce
  .number({ invalid_type_error: "Indica el monto." })
  .gt(0, "El monto debe ser mayor que 0.")
  .max(1_000_000)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "Máximo 2 decimales.");

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : undefined));

const motivoSchema = z.string().trim().min(5, "Indica el motivo (mínimo 5 caracteres).").max(500);

export const registrarPagoSchema = z
  .object({
    patientId: z.string().trim().min(1),
    budgetId: textoOpcional(100),
    concepto: textoOpcional(200),
    monto: montoSchema,
    formaPago: z.enum(FORMAS_PAGO),
    fecha: fechaIsoSchema,
    referencia: textoOpcional(100),
    profesionalUid: textoOpcional(128),
  })
  .superRefine((v, ctx) => {
    if (!v.budgetId && !v.concepto) {
      ctx.addIssue({ code: "custom", path: ["concepto"], message: "Indica el concepto del pago." });
    }
  });
export type RegistrarPagoInput = z.input<typeof registrarPagoSchema>;

export const anularPagoSchema = z.object({
  patientId: z.string().trim().min(1),
  pagoId: z.string().trim().min(1),
  motivo: motivoSchema,
});
export type AnularPagoInput = z.infer<typeof anularPagoSchema>;

export const registrarGastoSchema = z.object({
  fecha: fechaIsoSchema,
  monto: montoSchema,
  categoria: z.enum(CATEGORIAS_GASTO),
  descripcion: z.string().trim().min(1, "Describe el gasto.").max(300),
  formaPago: z.enum(FORMAS_PAGO),
});
export type RegistrarGastoInput = z.input<typeof registrarGastoSchema>;

export const anularGastoSchema = z.object({
  gastoId: z.string().trim().min(1),
  motivo: motivoSchema,
});
export type AnularGastoInput = z.infer<typeof anularGastoSchema>;

// ---------------------------------------------------------------------------
// Ciclo de vida de la atención: eliminar un borrador / anular una finalizada
// ---------------------------------------------------------------------------

export const eliminarAtencionSchema = referenciaVisitaSchema;
export type EliminarAtencionInput = z.infer<typeof eliminarAtencionSchema>;

export const anularAtencionSchema = referenciaVisitaSchema.extend({
  motivo: z.string().trim().min(5, "Indica el motivo (mínimo 5 caracteres).").max(500),
});
export type AnularAtencionInput = z.infer<typeof anularAtencionSchema>;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  usuario: z.string().trim().min(1).max(60),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const crearUsuarioSchema = z.object({
  centroId: z.string().trim().min(1),
  rol: z.enum(["admin", "profesional"]),
  usuario: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9._-]+$/i, "Solo letras, números, punto, guion y guion bajo"),
  password: z.string().min(8, "Mínimo 8 caracteres").max(200),
  nombreCompleto: z.string().trim().min(1).max(150),
  registroProfesional: z.string().trim().max(60).default(""),
});
export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export const actualizarUsuarioSchema = z.object({
  uid: z.string().min(1),
  centroId: z.string().trim().min(1).optional(),
  rol: z.enum(["admin", "profesional"]).optional(),
  nombreCompleto: z.string().trim().min(1).max(150).optional(),
  registroProfesional: z.string().trim().max(60).optional(),
  activo: z.boolean().optional(),
  // httpsCallable serializa los campos `undefined` del payload como `null`,
  // así que hay que aceptar ambos y normalizar a `undefined`.
  passwordNueva: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(200)
    .nullable()
    .optional()
    .transform((v) => v ?? undefined),
});
export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;

// ---------------------------------------------------------------------------
// Centros
// ---------------------------------------------------------------------------

/** Tamaño máximo del archivo de logo, antes de codificarlo en base64. */
export const LOGO_MAX_BYTES = 1024 * 1024;

/** Tipos de imagen aceptados para el logo de un centro. */
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg"] as const;

export const actualizarCentroSchema = z.object({
  centroId: z.string().trim().min(1),
  nombre: z.string().trim().min(1).max(150).optional(),
  direccion: z.string().trim().max(200).optional(),
  telefono: z.string().trim().max(40).optional(),
  piePdf: z.string().trim().max(300).optional(),
  // httpsCallable serializa los campos `undefined` del payload como `null`,
  // así que hay que aceptar ambos y normalizar a `undefined`.
  logo: z
    .object({
      // base64 sin el prefijo `data:`; infla el tamaño ~4/3, más margen de padding.
      base64: z
        .string()
        .min(1)
        .max(Math.ceil((LOGO_MAX_BYTES * 4) / 3) + 1024, "La imagen supera 1 MB"),
      mimeType: z.enum(LOGO_MIME_TYPES),
    })
    .nullable()
    .optional()
    .transform((v) => v ?? undefined),
  /** `true` borra el logo del centro y vuelve al logo Luna-Dental por defecto. */
  quitarLogo: z
    .boolean()
    .nullable()
    .optional()
    .transform((v) => v ?? undefined),
});
export type ActualizarCentroInput = z.infer<typeof actualizarCentroSchema>;

/** Hora de pared local 'YYYY-MM-DDTHH:MM'. El porqué del formato está en `agenda.ts`. */
export const marcaLocalSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Formato de fecha y hora inválido (YYYY-MM-DDTHH:MM)");

export const citaSchema = z
  .object({
    /**
     * `null` cuando se agenda sin ficha. El nombre se pide siempre, con ficha o
     * sin ella, porque va denormalizado en la cita; por eso no hace falta
     * validar «uno u otro».
     */
    patientId: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .optional()
      .transform((v) => v ?? undefined),
    pacienteNombre: z
      .string()
      .trim()
      .min(1, "El nombre del paciente es obligatorio")
      .max(240, "El nombre es demasiado largo"),
    pacienteTelefono: z.string().trim().max(30).optional().default(""),
    profesionalUid: z.string().trim().min(1, "Hay que elegir un profesional"),
    inicio: marcaLocalSchema,
    fin: marcaLocalSchema,
    motivo: z.string().trim().max(500).default(""),
    estado: z.enum(ESTADOS_CITA).default("pendiente"),
    notas: z.string().trim().max(2000).default(""),
  })
  // Comparar strings alcanza: las marcas locales ordenan lexicográficamente.
  .refine((c) => c.fin > c.inicio, {
    message: "La cita tiene que terminar después de empezar",
    path: ["fin"],
  })
  .refine((c) => c.inicio.slice(0, 10) === c.fin.slice(0, 10), {
    message: "La cita tiene que empezar y terminar el mismo día",
    path: ["fin"],
  });
export type CitaInput = z.infer<typeof citaSchema>;

export const cancelarCitaSchema = z.object({
  motivoCancelacion: z.string().trim().max(500).default(""),
});
export type CancelarCitaInput = z.infer<typeof cancelarCitaSchema>;

export const crearEnlacePortalSchema = z.object({
  patientId: z.string().trim().min(1, "Falta el paciente"),
});
export const revocarEnlacePortalSchema = crearEnlacePortalSchema;

/** 32 bytes en base64url = 43 caracteres. */
export const verPortalSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Enlace no válido"),
});
