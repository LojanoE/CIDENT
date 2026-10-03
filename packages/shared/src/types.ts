/**
 * Tipos compartidos entre `web` y `functions`.
 * Fuente de verdad única para la forma de los documentos de Firestore.
 */

// ---------------------------------------------------------------------------
// Identidad y centros
// ---------------------------------------------------------------------------

export type Rol = "admin" | "profesional";

/** Logo propio del centro, subido desde el panel de administración. */
export interface LogoCentro {
  storagePath: string;
  mimeType: string; // "image/png" | "image/jpeg"
  actualizadoEn: string; // ISO datetime
}

export interface Centro {
  centroId: string;
  nombre: string;
  direccion: string;
  telefono: string;
  piePdf: string;
  /** Ausente o `null`: los PDFs y la web usan el logo Luna-Dental por defecto. */
  logo?: LogoCentro | null;
  /** Último % de IVA usado en un presupuesto; prellena el formulario. */
  presupuestoIva?: number;
}

export interface Usuario {
  uid: string;
  centroId: string;
  rol: Rol;
  usuario: string;
  nombreCompleto: string;
  registroProfesional: string;
  activo: boolean;
  failedAttempts: number;
  lockedUntil: string | null; // ISO datetime
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Pacientes
// ---------------------------------------------------------------------------

export type Sexo = "M" | "F";

export interface Paciente {
  patientId: string;
  centroId: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  nombresLower: string;
  apellidosLower: string;
  sexo: Sexo;
  fechaNacimiento: string; // 'YYYY-MM-DD'
  telefono: string;
  direccion: string;
  email: string;
  alergias: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string; // uid
}

// ---------------------------------------------------------------------------
// Atenciones (visitas)
// ---------------------------------------------------------------------------

/** `draft` se edita; `final` queda bloqueada hasta reabrirla; `anulada` es terminal (solo la anula un admin). */
export type EstadoAtencion = "draft" | "final" | "anulada";

export interface IndicadoresHigiene {
  placa: number;
  calculo: number;
  gingivitis: number;
}

export interface ResultadoCPO {
  c: number;
  p: number;
  o: number;
  total: number;
}

export interface Atencion {
  visitId: string;
  centroId: string;
  patientId: string;
  fecha: string; // 'YYYY-MM-DD'
  motivo: string;
  problemaActual: string;
  antecedentes: string;
  signosVitales: string;
  examenEstomatognatico: string;
  indicadores: IndicadoresHigiene;
  cpo: ResultadoCPO;
  estado: EstadoAtencion;
  notas: string;
  createdAt: string;
  createdBy: string;
  finalizedAt: string | null;
  finalizedBy: string | null;
  /** Última vez que se guardó la ficha; ausente en atenciones anteriores a este campo. */
  updatedAt?: string;
  reabiertaAt?: string;
  reabiertaBy?: string;
  anuladaAt?: string;
  anuladaBy?: string;
  motivoAnulacion?: string;
}

// ---------------------------------------------------------------------------
// Odontograma
// ---------------------------------------------------------------------------

/** Las cinco zonas clínicas de una pieza dental. */
export const ZONAS = ["vestibular", "mesial", "oclusal", "distal", "lingual"] as const;
export type Zona = (typeof ZONAS)[number];

export type TipoOdontograma = "adulto" | "infantil";

/** Catálogo cerrado de condiciones clínicas (idéntico al legado, `app.py:37-49`). */
export const CONDICIONES = [
  "Sano",
  "Caries",
  "Obturación",
  "Endodoncia",
  "Corona",
  "Prótesis Total",
  "Sellante Necesario",
  "Sellante Realizado",
  "Extracción Indicada",
  "Pérdida por Caries",
  "Pérdida",
  "Prótesis Fija",
  "Prótesis Removible",
] as const;
export type Condicion = (typeof CONDICIONES)[number];

export interface EstadoZona {
  estados: Condicion[];
  color: string;
  nota: string;
}

export interface EstadoDiente {
  general?: EstadoZona;
  zonas: Partial<Record<Zona, EstadoZona>>;
}

/** Mapa FDI (como string, ej. "18") → estado del diente. */
export type Odontograma = Record<string, EstadoDiente>;

export interface OdontogramaDoc {
  centroId: string;
  patientId: string;
  visitId: string;
  tipo: TipoOdontograma;
  dientes: Odontograma;
  updatedAt: string;
  updatedBy: string;
}

// ---------------------------------------------------------------------------
// Higiene
// ---------------------------------------------------------------------------

export interface IndiceHigieneDiente {
  placa: number;
  calculo: number;
  gingivitis: number;
}

export interface HigieneDoc {
  centroId: string;
  visitId: string;
  dientes: Record<string, IndiceHigieneDiente>;
}

// ---------------------------------------------------------------------------
// Documentos generados
// ---------------------------------------------------------------------------

export interface ArchivoRef {
  storagePath: string;
  nombre: string;
}

export interface Receta {
  id: string;
  centroId: string;
  patientId: string;
  visitId: string;
  fecha: string;
  diagnostico: string;
  indicaciones: string;
  medicamentos: string;
  recomendaciones: string;
  codigoUnico: string;
  archivo: ArchivoRef;
  emitidoPor: string; // uid
  createdAt: string;
}

export interface Certificado {
  id: string;
  centroId: string;
  patientId: string;
  visitId: string;
  fecha: string;
  motivo: string;
  observaciones: string;
  codigoUnico: string;
  archivo: ArchivoRef;
  emitidoPor: string;
  createdAt: string;
}

export const ESTADOS_PRESUPUESTO = ["pendiente", "aceptado", "rechazado"] as const;
export type EstadoPresupuesto = (typeof ESTADOS_PRESUPUESTO)[number];

export interface LineaPresupuesto {
  tratamiento: string;
  pieza?: string;
  cantidad: number;
  precioUnitario: number;
  totalLinea: number;
}

export interface Presupuesto {
  id: string;
  centroId: string;
  patientId: string;
  visitId: string;
  fecha: string;
  codigoUnico: string;
  lineas: LineaPresupuesto[];
  subtotal: number;
  descuentoPorcentaje: number;
  descuento: number;
  ivaPorcentaje: number;
  iva: number;
  total: number;
  validezDias: number;
  observaciones: string;
  estado: EstadoPresupuesto;
  estadoActualizadoAt?: string;
  estadoActualizadoBy?: string;
  /** Suma de los pagos vigentes; la mantiene el backend. Saldo = total − pagado. */
  pagado?: number;
  archivo: ArchivoRef;
  emitidoPor: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Contabilidad: pagos de pacientes y gastos del centro
// ---------------------------------------------------------------------------

export const FORMAS_PAGO = ["efectivo", "transferencia", "tarjeta", "otro"] as const;
export type FormaPago = (typeof FORMAS_PAGO)[number];

export const CATEGORIAS_GASTO = ["insumos", "alquiler", "servicios", "sueldos", "laboratorio", "otros"] as const;
export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

/** Un movimiento anulado se conserva pero no suma en ningún total. */
export const ESTADOS_MOVIMIENTO = ["vigente", "anulado"] as const;
export type EstadoMovimiento = (typeof ESTADOS_MOVIMIENTO)[number];

export interface Pago {
  id: string;
  centroId: string;
  patientId: string;
  budgetId?: string;
  presupuestoCodigo?: string;
  concepto: string;
  fecha: string;
  monto: number;
  formaPago: FormaPago;
  referencia?: string;
  /** Profesional al que se atribuye el ingreso. */
  profesionalUid: string;
  codigoUnico: string;
  /** Saldo del presupuesto tras este pago (solo si está ligado a uno). */
  saldoDespues?: number;
  archivo: ArchivoRef;
  estado: EstadoMovimiento;
  motivoAnulacion?: string;
  anuladoAt?: string;
  anuladoBy?: string;
  registradoPor: string;
  createdAt: string;
}

export interface Gasto {
  id: string;
  centroId: string;
  fecha: string;
  monto: number;
  categoria: CategoriaGasto;
  descripcion: string;
  formaPago: FormaPago;
  estado: EstadoMovimiento;
  motivoAnulacion?: string;
  anuladoAt?: string;
  anuladoBy?: string;
  registradoPor: string;
  createdAt: string;
}

/** Tratamientos que el centro ya presupuestó, con su último precio (autocompletado). */
export interface TratamientoCatalogo {
  nombre: string;
  precioUnitario: number;
  usos: number;
  updatedAt: string;
}

export interface Adjunto {
  id: string;
  centroId: string;
  patientId: string;
  visitId: string;
  fecha: string;
  nombre: string;
  mimeType: string;
  size: number;
  archivo: { storagePath: string };
  uploadedBy: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

export const ESTADOS_CITA = [
  "pendiente",
  "confirmada",
  "atendida",
  "cancelada",
  "ausente",
] as const;
export type EstadoCita = (typeof ESTADOS_CITA)[number];

/**
 * Cita de la agenda compartida del centro: `appointments/{appointmentId}`.
 *
 * Los centros siguen aislados por `centroId`; lo que se comparte es la agenda
 * *dentro* de un centro, donde cualquier profesional puede agendar para sí
 * mismo o para un colega.
 */
export interface Cita {
  appointmentId: string;
  centroId: string;

  /** Ficha del paciente, o `null` si se agendó sin ficha (solo nombre y teléfono). */
  patientId: string | null;
  /**
   * Denormalizado a propósito: una vista de semana con decenas de citas no
   * puede leer una ficha por cita. El costo es que un cambio de nombre no se
   * propaga a las citas ya agendadas, que para un registro de agenda es
   * incluso lo correcto.
   */
  pacienteNombre: string;
  pacienteTelefono: string;

  profesionalUid: string;
  /** Denormalizado por la misma razón que `pacienteNombre`. */
  profesionalNombre: string;

  /** Hora de pared local 'YYYY-MM-DDTHH:MM'. El porqué está en `agenda.ts`. */
  inicio: string;
  fin: string;

  motivo: string;
  estado: EstadoCita;
  notas: string;

  /** Atención iniciada desde esta cita, si ya se abrió. */
  visitId: string | null;

  /**
   * Autoría en el propio documento. Las citas se escriben desde el cliente
   * (el solapamiento advierte pero no bloquea, así que no hace falta una
   * callable), y `registrarAuditoria` solo corre del lado servidor: sin estos
   * campos no quedaría rastro de quién movió un turno de un colega.
   */
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  canceladaEn: string | null;
  canceladaPor: string | null;
  motivoCancelacion: string;
}

// ---------------------------------------------------------------------------
// Portal del paciente (enlace / QR, sin cuenta)
// ---------------------------------------------------------------------------

/** `portalLinks/{sha256(token)}`: el token en claro nunca se guarda. */
export interface EnlacePortal {
  centroId: string;
  patientId: string;
  creadoPor: string; // uid
  creadoAt: string; // ISO
  expiraAt: string; // ISO
  revocado: boolean;
}

/** Respuesta de `verPortalPaciente`: datos ya filtrados, sin dinero ni datos personales sensibles. */
export interface PortalPacienteDatos {
  centro: { nombre: string; telefono: string; direccion: string; logoDataUrl: string | null };
  paciente: { nombre: string };
  odontograma: { tipo: TipoOdontograma; dientes: Odontograma; fecha: string } | null;
  plan: {
    fecha: string;
    estado: EstadoPresupuesto;
    tratamientos: Array<{ tratamiento: string; pieza?: string; cantidad: number }>;
  } | null;
  citas: Array<{ inicio: string; profesionalNombre: string; motivo: string }>;
}
