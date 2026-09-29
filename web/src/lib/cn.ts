export type ClaseCondicional = string | false | null | undefined;

/** Une clases descartando los valores falsos. Las variantes son mapas cerrados, así que no hace falta resolver conflictos. */
export function cn(...clases: ClaseCondicional[]): string {
  return clases.filter(Boolean).join(" ");
}
