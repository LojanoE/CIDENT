import { FDI_PERMANENTES, FDI_TEMPORALES } from "./odontograma.js";

// ---------------------------------------------------------------------------
// Fotos clínicas: tipo de toma y piezas que cubre
// ---------------------------------------------------------------------------

export const TIPOS_TOMA = [
  "frontal",
  "lateral_der",
  "lateral_izq",
  "oclusal_sup",
  "oclusal_inf",
  "primer_plano",
  "radiografia",
  "otro",
] as const;
export type TipoToma = (typeof TIPOS_TOMA)[number];

export const ETIQUETA_TOMA: Record<TipoToma, string> = {
  frontal: "Frontal",
  lateral_der: "Lateral derecha",
  lateral_izq: "Lateral izquierda",
  oclusal_sup: "Oclusal superior",
  oclusal_inf: "Oclusal inferior",
  primer_plano: "Primer plano",
  radiografia: "Radiografía",
  otro: "Otra",
};

/** Set estándar de fotos intraorales, en el orden en que se toman. */
export const SET_INTRAORAL: readonly TipoToma[] = [
  "frontal",
  "lateral_der",
  "lateral_izq",
  "oclusal_sup",
  "oclusal_inf",
];

/** Tomas cuyas piezas no se deducen del tipo: las elige el profesional. */
export const TOMAS_POR_PIEZA: readonly TipoToma[] = ["primer_plano", "radiografia"];

export type Denticion = "permanente" | "temporal";

/** `pieza = 10·cuadrante + posición`; el cuadrante 1/5 = sup. derecho, 2/6 = sup. izquierdo, 3/7 = inf. izquierdo, 4/8 = inf. derecho. */
function cuadrante(fdi: number): number {
  return Math.floor(fdi / 10);
}
function posicion(fdi: number): number {
  return fdi % 10;
}

/**
 * Piezas que muestra una toma estándar. Las tomas «por pieza» (primer plano,
 * radiografía) y «otro» devuelven `[]`: ahí las piezas las elige el usuario.
 */
export function piezasDeToma(tipo: TipoToma, denticion: Denticion = "permanente"): number[] {
  const lista = denticion === "permanente" ? FDI_PERMANENTES : FDI_TEMPORALES;
  // Cuadrantes de cada arcada/lado según la dentición (permanente 1-4, temporal 5-8).
  const base = denticion === "permanente" ? 0 : 4;
  const [supDer, supIzq, infIzq, infDer] = [1 + base, 2 + base, 3 + base, 4 + base];
  // Posición del canino: 3 en ambas denticiones (temporal: 1-2 incisivos, 3 canino, 4-5 molares).
  const canino = 3;

  let piezas: number[];
  switch (tipo) {
    case "frontal":
      piezas = lista.filter((f) => posicion(f) <= canino);
      break;
    case "lateral_der":
      piezas = lista.filter((f) => [supDer, infDer].includes(cuadrante(f)) && posicion(f) >= canino);
      break;
    case "lateral_izq":
      piezas = lista.filter((f) => [supIzq, infIzq].includes(cuadrante(f)) && posicion(f) >= canino);
      break;
    case "oclusal_sup":
      piezas = lista.filter((f) => [supDer, supIzq].includes(cuadrante(f)));
      break;
    case "oclusal_inf":
      piezas = lista.filter((f) => [infIzq, infDer].includes(cuadrante(f)));
      break;
    default:
      piezas = [];
  }
  return [...piezas].sort((a, b) => a - b);
}

/** Dentición a la que pertenece una pieza: las FDI 5x–8x son temporales. */
export function denticionDePieza(fdi: number): Denticion {
  return cuadrante(fdi) >= 5 ? "temporal" : "permanente";
}

/** Subconjunto mínimo de un adjunto necesario para ubicarlo por pieza. */
export interface AdjuntoConPiezas {
  piezas?: number[] | undefined;
  createdAt: string;
}

/** Adjuntos que muestran la pieza `fdi`, del más antiguo al más reciente. */
export function adjuntosDePieza<T extends AdjuntoConPiezas>(fdi: number, adjuntos: readonly T[]): T[] {
  return adjuntos
    .filter((a) => a.piezas?.includes(fdi))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Convierte «11,12, 13» a `[11,12,13]` descartando lo que no sea una FDI válida (sin duplicados). */
export function parsearPiezas(texto: string | null | undefined): number[] {
  if (!texto) return [];
  const validas = new Set<number>([...FDI_PERMANENTES, ...FDI_TEMPORALES]);
  const salida = new Set<number>();
  for (const parte of texto.split(",")) {
    const n = Number(parte.trim());
    if (Number.isInteger(n) && validas.has(n)) salida.add(n);
  }
  return [...salida].sort((a, b) => a - b);
}

/** Valida un texto de tipo de toma; `undefined` si no es uno conocido. */
export function parsearToma(texto: string | null | undefined): TipoToma | undefined {
  return (TIPOS_TOMA as readonly string[]).includes(texto ?? "") ? (texto as TipoToma) : undefined;
}
