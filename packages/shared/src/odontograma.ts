import type { Condicion, Zona } from "./types.js";

// ---------------------------------------------------------------------------
// Piezas dentales (numeración FDI)
// ---------------------------------------------------------------------------

/**
 * 32 piezas permanentes, en orden de dibujo, vistas de frente al paciente:
 * 18→11 | 21→28 arriba y 48→41 | 31→38 abajo. (`app.py:39` dibujaba la arcada
 * inferior como 38→31 | 41→48, con los cuadrantes 3 y 4 cruzados.)
 */
export const FDI_PERMANENTES: readonly number[] = [
  ...range(18, 10, -1),
  ...range(21, 29),
  ...range(48, 40, -1),
  ...range(31, 39),
];

/** 20 piezas temporales (dentición infantil). */
export const FDI_TEMPORALES: readonly number[] = [
  ...range(55, 50, -1),
  ...range(61, 66),
  ...range(85, 80, -1),
  ...range(71, 76),
];

function range(start: number, stop: number, step = 1): number[] {
  const out: number[] = [];
  if (step > 0) {
    for (let i = start; i < stop; i += step) out.push(i);
  } else {
    for (let i = start; i > stop; i += step) out.push(i);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Símbolos y colores (idéntico a `app.py:41-58`, reutilizado en pantalla y PDF)
// ---------------------------------------------------------------------------

export const CONDITION_SYMBOLS: Record<Condicion, string> = {
  Sano: "circulo",
  Caries: "circulo",
  Obturación: "circulo",
  Endodoncia: "triangulo",
  Corona: "cuadrado",
  "Prótesis Total": "igual",
  "Sellante Necesario": "asterisco",
  "Sellante Realizado": "asterisco",
  "Extracción Indicada": "aspa",
  "Pérdida por Caries": "aspa",
  Pérdida: "circulo-hueco",
  "Prótesis Fija": "puente",
  "Prótesis Removible": "parentesis",
};

export const CONDITION_COLORS: Partial<Record<Condicion, string>> = {
  Caries: "#FF0000",
  Obturación: "#0000FF",
  "Sellante Necesario": "#FF0000",
  "Sellante Realizado": "#0000FF",
  "Extracción Indicada": "#FF0000",
  "Pérdida por Caries": "#0000FF",
};

/** Paleta de 6 colores del editor (`App.COLORS`, `app.py:38`) + selector personalizado en la UI. */
export const COLORS_PALETA: readonly string[] = [
  "#1E90FF",
  "#FF4500",
  "#3CB371",
  "#FFD700",
  "#8A2BE2",
  "#000000",
];

// ---------------------------------------------------------------------------
// CPO — categorías (usadas también por cpo.ts)
// ---------------------------------------------------------------------------

export const CPO_CATEGORIAS = {
  C: ["Caries"] as Condicion[],
  P: ["Pérdida", "Pérdida por Caries", "Extracción Indicada"] as Condicion[],
  O: ["Obturación", "Endodoncia", "Corona"] as Condicion[],
} as const;

// ---------------------------------------------------------------------------
// Lateralidad — corrige `app.py:1229-1235`
// ---------------------------------------------------------------------------
//
// El código legado dibuja el odontograma con bandas horizontales fijas
// (vestibular arriba, lingual abajo, mesial izquierda, distal derecha) para
// TODAS las piezas, sin invertir mesial/distal según el cuadrante ni
// vestibular/lingual según la arcada. Clínicamente eso es incorrecto:
// mesial siempre es "hacia la línea media" y distal "hacia atrás",
// independientemente de en qué lado del gráfico caiga la pieza.

export type Cuadrante = 1 | 2 | 3 | 4;
export type Arcada = "superior" | "inferior";
/** Posición geométrica fija del polígono dentro del `<g>` del diente en el SVG. */
export type PosicionGeometrica = "arriba" | "abajo" | "izquierda" | "derecha" | "centro";

/**
 * Cuadrante clínico (1-4) de una pieza FDI, incluyendo dentición temporal
 * (5→I, 6→II, 7→III, 8→IV).
 */
export function cuadranteDe(fdi: number): Cuadrante {
  const primerDigito = Math.floor(fdi / 10);
  const mapa: Record<number, Cuadrante> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 1, 6: 2, 7: 3, 8: 4 };
  const cuadrante = mapa[primerDigito];
  if (!cuadrante) {
    throw new Error(`FDI inválido: ${fdi}`);
  }
  return cuadrante;
}

export function arcadaDe(fdi: number): Arcada {
  const q = cuadranteDe(fdi);
  return q === 1 || q === 2 ? "superior" : "inferior";
}

/**
 * Lado del SVG (izquierda/derecha del `<g>` del diente) donde cae la zona
 * MESIAL de esta pieza. En los cuadrantes 1 y 4 la numeración desciende
 * hacia la línea media (18→11, 48→41): mesial queda a la derecha del `<g>`.
 * En los cuadrantes 2 y 3 la numeración asciende desde la línea media
 * (21→28, 31→38): mesial queda a la izquierda del `<g>`.
 */
export function ladoMesialEnSvg(fdi: number): "izquierda" | "derecha" {
  const q = cuadranteDe(fdi);
  return q === 1 || q === 4 ? "derecha" : "izquierda";
}

/**
 * Traduce una posición geométrica fija del `<g>` de un diente a su nombre de
 * zona clínico correcto, considerando cuadrante y arcada. Esta es la función
 * que reemplaza las bandas fijas de `app.py:1229-1235`.
 */
export function zonaDeLado(fdi: number, posicion: PosicionGeometrica): Zona {
  if (posicion === "centro") return "oclusal";

  if (posicion === "arriba" || posicion === "abajo") {
    const esVestibular =
      arcadaDe(fdi) === "superior" ? posicion === "arriba" : posicion === "abajo";
    return esVestibular ? "vestibular" : "lingual";
  }

  // izquierda / derecha → mesial / distal
  const esMesial = posicion === ladoMesialEnSvg(fdi);
  return esMesial ? "mesial" : "distal";
}

// ---------------------------------------------------------------------------
// Higiene oral (índices de placa, cálculo y gingivitis)
// ---------------------------------------------------------------------------

/** Las 18 piezas índice de O'Leary/OMS usadas para los promedios de higiene (`app.py:59`). */
export const HYGIENE_TEETH: readonly number[] = [
  11, 16, 17, 21, 26, 27, 31, 36, 37, 41, 46, 47, 51, 55, 65, 71, 75, 85,
];

export const HYGIENE_LIMITS = {
  placa: [0, 3] as const,
  calculo: [0, 3] as const,
  gingivitis: [0, 1] as const,
};
