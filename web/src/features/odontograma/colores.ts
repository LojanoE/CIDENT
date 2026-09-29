export const TINTA = "hsl(var(--ink))";

/**
 * Color legible sobre un relleno. Los rellenos son datos clínicos (rojo, azul, negro…) y no
 * siempre dejan leer una marca oscura: sobre fondos oscuros se usa blanco.
 */
export function colorSobre(relleno: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(relleno);
  if (!m) return TINTA;
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((c) => parseInt(c, 16) / 255) as [number, number, number];
  const luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminancia < 0.35 ? "#ffffff" : TINTA;
}
