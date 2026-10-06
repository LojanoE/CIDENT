import { diaDe, diaDeLaSemana, horaDe } from "./agenda.js";

/**
 * Mensaje de recordatorio de cita. Cada centro puede cambiar la plantilla desde la cuenta del
 * administrador; las variables entre llaves se reemplazan al armar el texto de WhatsApp.
 */

export const VARIABLES_RECORDATORIO = [
  { clave: "paciente", ayuda: "Nombre del paciente" },
  { clave: "fecha", ayuda: "Día de la cita (ej. martes 7 de octubre)" },
  { clave: "hora", ayuda: "Hora de la cita (ej. 15:30)" },
  { clave: "profesional", ayuda: "Profesional que atiende" },
  { clave: "centro", ayuda: "Nombre del centro" },
  { clave: "direccion", ayuda: "Dirección del centro" },
  { clave: "telefono", ayuda: "Teléfono del centro" },
] as const;

export type VariableRecordatorio = (typeof VARIABLES_RECORDATORIO)[number]["clave"];

export const PLANTILLA_RECORDATORIO_DEFECTO =
  "Hola {paciente}, le recordamos su cita en {centro} el {fecha} a las {hora} con {profesional}. " +
  "Si no puede asistir, avísenos por favor. ¡Lo esperamos!";

export const PLANTILLA_RECORDATORIO_MAX = 600;

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** 'YYYY-MM-DDTHH:MM' → «martes 7 de octubre». */
export function fechaLargaDe(marca: string): string {
  const dia = diaDe(marca);
  const [, mes, d] = dia.split("-").map(Number);
  return `${DIAS[diaDeLaSemana(dia)]} ${d} de ${MESES[(mes ?? 1) - 1]}`;
}

export interface DatosRecordatorio {
  paciente: string;
  /** Inicio de la cita, 'YYYY-MM-DDTHH:MM'. */
  inicio: string;
  profesional: string;
  centro: string;
  direccion?: string;
  telefono?: string;
}

/** Reemplaza las variables de la plantilla; una variable desconocida se deja tal cual. */
export function armarRecordatorio(plantilla: string | undefined, datos: DatosRecordatorio): string {
  const base = plantilla?.trim() ? plantilla : PLANTILLA_RECORDATORIO_DEFECTO;
  const valores: Record<VariableRecordatorio, string> = {
    // Nombre tal como está en la cita: con ficha es «Apellidos Nombres», y el primer token sería el apellido.
    paciente: datos.paciente.trim(),
    fecha: fechaLargaDe(datos.inicio),
    hora: horaDe(datos.inicio),
    profesional: datos.profesional,
    centro: datos.centro,
    direccion: datos.direccion ?? "",
    telefono: datos.telefono ?? "",
  };
  return base.replace(/\{(\w+)\}/g, (completo, clave: string) =>
    clave in valores ? valores[clave as VariableRecordatorio] : completo,
  );
}
