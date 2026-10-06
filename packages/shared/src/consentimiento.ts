import { z } from "zod";

export const PLANTILLAS_CONSENTIMIENTO = ["general", "extraccion", "endodoncia", "anestesia", "blanqueamiento"] as const;
export type PlantillaConsentimiento = (typeof PLANTILLAS_CONSENTIMIENTO)[number];

export const VARIABLES_CONSENTIMIENTO = ["paciente", "cedula", "tratamiento", "pieza", "profesional", "centro"] as const;
export type VariableConsentimiento = (typeof VARIABLES_CONSENTIMIENTO)[number];

export const CONSENTIMIENTO_TEXTO_MAX = 6000;
/** Tope del PNG de la firma (data URL ya decodificado). */
export const FIRMA_PACIENTE_MAX_BYTES = 300 * 1024;

interface PlantillaDef {
  titulo: string;
  texto: string;
}

const PIE_COMUN =
  "He recibido explicaciones claras sobre el procedimiento, sus riesgos y alternativas, y he podido hacer todas las preguntas que consideré necesarias. Entiendo que puedo retirar este consentimiento antes del procedimiento. Declaro que la información que he dado sobre mi salud es verdadera y completa.";

export const CONSENTIMIENTOS: Record<PlantillaConsentimiento, PlantillaDef> = {
  general: {
    titulo: "Consentimiento informado para atención odontológica",
    texto:
      "Yo, {paciente}, con cédula {cedula}, autorizo a {profesional} de {centro} a realizar el siguiente tratamiento: {tratamiento}{pieza}.\n\n" +
      "Riesgos posibles: molestia o dolor posoperatorio, sensibilidad dental, inflamación o sangrado leve, y necesidad de tratamientos adicionales.\n\n" +
      "Alternativas: no realizar el tratamiento, posponerlo o elegir otra opción terapéutica explicada por el profesional.\n\n" +
      PIE_COMUN,
  },
  extraccion: {
    titulo: "Consentimiento informado para extracción / cirugía oral",
    texto:
      "Yo, {paciente}, con cédula {cedula}, autorizo a {profesional} de {centro} a realizar: {tratamiento}{pieza}.\n\n" +
      "Riesgos posibles: dolor, inflamación y hematoma, sangrado, infección, alveolitis (alvéolo seco), lesión de dientes o estructuras vecinas, parestesia temporal o permanente, comunicación con el seno maxilar y fractura de raíces o del hueso.\n\n" +
      "Alternativas: conservar la pieza con otro tratamiento, control periódico o no intervenir, con los riesgos que eso implica.\n\n" +
      PIE_COMUN,
  },
  endodoncia: {
    titulo: "Consentimiento informado para endodoncia",
    texto:
      "Yo, {paciente}, con cédula {cedula}, autorizo a {profesional} de {centro} a realizar: {tratamiento}{pieza}.\n\n" +
      "Riesgos posibles: dolor o inflamación posoperatoria, fractura de instrumentos dentro del conducto, perforación radicular, imposibilidad de completar el tratamiento, fracaso con necesidad de retratamiento, cirugía o extracción, y fractura posterior de la pieza si no se restaura.\n\n" +
      "Alternativas: extracción de la pieza o no realizar el tratamiento.\n\n" +
      PIE_COMUN,
  },
  anestesia: {
    titulo: "Consentimiento informado para anestesia local",
    texto:
      "Yo, {paciente}, con cédula {cedula}, autorizo a {profesional} de {centro} a aplicar anestesia local para: {tratamiento}{pieza}.\n\n" +
      "Riesgos posibles: dolor o hematoma en el sitio de la punción, adormecimiento prolongado, reacción alérgica, mareo o desmayo, y mordedura accidental de labio o lengua mientras dura el efecto.\n\n" +
      "Alternativas: realizar el tratamiento sin anestesia o con otra técnica indicada por el profesional.\n\n" +
      PIE_COMUN,
  },
  blanqueamiento: {
    titulo: "Consentimiento informado para blanqueamiento dental",
    texto:
      "Yo, {paciente}, con cédula {cedula}, autorizo a {profesional} de {centro} a realizar: {tratamiento}{pieza}.\n\n" +
      "Riesgos posibles: sensibilidad dental temporal, irritación de encías, resultado variable según el tipo de mancha y que las restauraciones existentes no cambian de color.\n\n" +
      "Alternativas: no realizar el tratamiento, o usar otras opciones estéticas como carillas o restauraciones.\n\n" +
      PIE_COMUN,
  },
};

export const ETIQUETAS_CONSENTIMIENTO: Record<PlantillaConsentimiento, string> = {
  general: "General",
  extraccion: "Extracción / cirugía",
  endodoncia: "Endodoncia",
  anestesia: "Anestesia local",
  blanqueamiento: "Blanqueamiento",
};

export interface DatosConsentimiento {
  paciente: string;
  cedula: string;
  tratamiento: string;
  pieza?: string;
  profesional: string;
  centro: string;
}

/** Texto de la plantilla con las variables reemplazadas. La pieza se escribe «, pieza 16» o queda vacía. */
export function armarConsentimiento(plantilla: PlantillaConsentimiento, datos: DatosConsentimiento): string {
  const valores: Record<VariableConsentimiento, string> = {
    paciente: datos.paciente.trim(),
    cedula: datos.cedula.trim(),
    tratamiento: datos.tratamiento.trim() || "el tratamiento indicado",
    pieza: datos.pieza?.trim() ? `, pieza ${datos.pieza.trim()}` : "",
    profesional: datos.profesional.trim(),
    centro: datos.centro.trim(),
  };
  return CONSENTIMIENTOS[plantilla].texto.replace(/\{(\w+)\}/g, (m, clave: string) =>
    clave in valores ? valores[clave as VariableConsentimiento] : m,
  );
}

const PREFIJO_PNG = "data:image/png;base64,";

/** Data URL PNG con tamaño decodificado acotado. La firma binaria real se valida en el servidor. */
export const firmaPacienteSchema = z
  .string()
  .startsWith(PREFIJO_PNG, "La firma debe ser un PNG")
  .refine(
    (s) => Math.floor(((s.length - PREFIJO_PNG.length) * 3) / 4) <= FIRMA_PACIENTE_MAX_BYTES,
    "La firma es demasiado grande",
  );

export const generarConsentimientoSchema = z.object({
  patientId: z.string().trim().min(1),
  visitId: z.string().trim().min(1),
  plantilla: z.enum(PLANTILLAS_CONSENTIMIENTO),
  tratamiento: z.string().trim().min(1, "Indica el tratamiento").max(300),
  pieza: z
    .string()
    .trim()
    .max(10)
    .nullable()
    .optional()
    .transform((v) => v ?? undefined),
  textoFinal: z.string().trim().min(20, "El texto es demasiado corto").max(CONSENTIMIENTO_TEXTO_MAX),
  firmaPaciente: firmaPacienteSchema,
  firmante: z.object({
    nombre: z.string().trim().min(1, "Indica el nombre de quien firma").max(160),
    cedula: z.string().trim().min(1, "Indica la cédula de quien firma").max(20),
    relacion: z.enum(["paciente", "representante"]),
  }),
});
export type GenerarConsentimientoInput = z.infer<typeof generarConsentimientoSchema>;
