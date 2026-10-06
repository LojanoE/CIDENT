import { z } from "zod";
import type { Anamnesis } from "./types.js";

/** Condiciones de la ficha médica, con su etiqueta y la gravedad de la alerta que generan (si generan). */
export const CONDICIONES_ANAMNESIS = [
  { clave: "anticoagulantes", etiqueta: "Toma anticoagulantes", nivel: "alta" },
  { clave: "coagulopatia", etiqueta: "Trastorno de coagulación", nivel: "alta" },
  { clave: "alergiaAnestesia", etiqueta: "Alergia a la anestesia", nivel: "alta" },
  { clave: "alergiaPenicilina", etiqueta: "Alergia a la penicilina", nivel: "alta" },
  { clave: "cardiopatia", etiqueta: "Cardiopatía", nivel: "alta" },
  { clave: "embarazo", etiqueta: "Embarazo", nivel: "alta" },
  { clave: "diabetes", etiqueta: "Diabetes", nivel: "media" },
  { clave: "hipertension", etiqueta: "Hipertensión", nivel: "media" },
  { clave: "epilepsia", etiqueta: "Epilepsia", nivel: "media" },
  { clave: "asma", etiqueta: "Asma", nivel: "media" },
  { clave: "hepatitis", etiqueta: "Hepatitis", nivel: "media" },
  { clave: "vih", etiqueta: "VIH", nivel: "media" },
  { clave: "fumador", etiqueta: "Fumador", nivel: null },
  { clave: "bruxismo", etiqueta: "Bruxismo", nivel: null },
] as const satisfies readonly { clave: keyof Anamnesis; etiqueta: string; nivel: "alta" | "media" | null }[];

export interface AlertaClinica {
  texto: string;
  nivel: "alta" | "media";
}

const bool = z.boolean().nullable().optional().transform((v) => v ?? false);
const texto = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((v) => v ?? "");

export const anamnesisSchema = z.object({
  diabetes: bool,
  hipertension: bool,
  cardiopatia: bool,
  anticoagulantes: bool,
  coagulopatia: bool,
  embarazo: bool,
  asma: bool,
  epilepsia: bool,
  hepatitis: bool,
  vih: bool,
  fumador: bool,
  bruxismo: bool,
  alergiaAnestesia: bool,
  alergiaPenicilina: bool,
  medicacion: texto(500),
  enfermedades: texto(1000),
  cirugias: texto(1000),
  observaciones: texto(1000),
});
export type AnamnesisInput = z.infer<typeof anamnesisSchema>;

/** Ficha vacía, para el formulario de un paciente sin ficha todavía. */
export function anamnesisVacia(): AnamnesisInput {
  return anamnesisSchema.parse({});
}

/**
 * Alertas a mostrar junto al paciente: alergias en texto libre (alta), condiciones de riesgo (alta)
 * y condiciones a tener presentes (media). Las altas van primero.
 */
export function alertasAnamnesis(a: Partial<Anamnesis> | undefined, alergias?: string): AlertaClinica[] {
  const alertas: AlertaClinica[] = [];
  const alerg = alergias?.trim();
  if (alerg) alertas.push({ texto: `Alergias: ${alerg}`, nivel: "alta" });
  if (a) {
    for (const c of CONDICIONES_ANAMNESIS) {
      if (c.nivel && a[c.clave]) alertas.push({ texto: c.etiqueta, nivel: c.nivel });
    }
    const med = a.medicacion?.trim();
    if (med) alertas.push({ texto: `Medicación: ${med}`, nivel: "media" });
  }
  return [...alertas.filter((x) => x.nivel === "alta"), ...alertas.filter((x) => x.nivel === "media")];
}
