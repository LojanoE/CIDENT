import { arcadaDe, cuadranteDe, ladoMesialEnSvg } from "./odontograma.js";
import type { Condicion, EstadoDiente, Zona } from "./types.js";
import { ZONAS } from "./types.js";

// ---------------------------------------------------------------------------
// Arcada 3D: lógica pura (sin three.js) para colocar y pintar cada pieza.
//
// Sistema de coordenadas (unidades ≈ cm), mirando al paciente de frente:
//   +x = derecha de quien mira (cuadrantes 2 y 3), +y = arriba, +z = hacia quien mira.
// Cada diente se modela en su marco local con la corona hacia +y, vestibular en +z,
// lingual en -z y oclusal en +y. `posicionPieza` indica cómo girarlo/invertirlo.
// ---------------------------------------------------------------------------

export type TipoPieza = "incisivo" | "canino" | "premolar" | "molar";

/** Dígito de posición dentro del cuadrante (1 = incisivo central). */
function posicionEnCuadrante(fdi: number): number {
  return fdi % 10;
}

function esTemporal(fdi: number): boolean {
  return Math.floor(fdi / 10) >= 5;
}

export function tipoDePieza(fdi: number): TipoPieza {
  cuadranteDe(fdi); // valida el FDI
  const n = posicionEnCuadrante(fdi);
  if (n <= 2) return "incisivo";
  if (n === 3) return "canino";
  if (esTemporal(fdi)) return "molar";
  return n <= 5 ? "premolar" : "molar";
}

/** Ancho mesio-distal aproximado de cada pieza, en cm. */
const ANCHO_PERMANENTE = [0, 0.85, 0.65, 0.78, 0.7, 0.68, 1.0, 0.95, 0.9];
const ANCHO_TEMPORAL = [0, 0.65, 0.55, 0.7, 0.8, 1.0];

export function anchoDePieza(fdi: number): number {
  const n = posicionEnCuadrante(fdi);
  const tabla = esTemporal(fdi) ? ANCHO_TEMPORAL : ANCHO_PERMANENTE;
  const ancho = tabla[n];
  if (!ancho) throw new Error(`FDI inválido: ${fdi}`);
  return ancho;
}

/** La arcada es la parábola z = Z_FRENTE - K·x², recorrida por longitud de arco. */
const K = 0.075;
const Z_FRENTE = 2.6;
const SEPARACION_OCLUSAL = 0.06;
const PASO_ARCO = 0.01;

/** Punto de la curva a `s` cm de la línea media (por longitud de arco). */
export function puntoEnArco(s: number): { x: number; z: number } {
  let x = 0;
  let recorrido = 0;
  while (recorrido < s) {
    const dz = 2 * K * x; // dz/dx
    const largo = Math.sqrt(1 + dz * dz);
    const dx = PASO_ARCO / largo;
    x += dx;
    recorrido += PASO_ARCO;
  }
  return { x, z: Z_FRENTE - K * x * x };
}

export interface PosicionPieza {
  x: number;
  y: number;
  z: number;
  /** Giro alrededor de Y (rad) para que el vestibular mire hacia afuera de la arcada. */
  rotY: number;
  ancho: number;
  /** Arcada superior: se dibuja con `scale.y = -1` (corona hacia abajo, raíz hacia arriba). */
  invertido: boolean;
}

export function posicionPieza(fdi: number): PosicionPieza {
  const cuadrante = cuadranteDe(fdi);
  const n = posicionEnCuadrante(fdi);
  const tabla = esTemporal(fdi) ? ANCHO_TEMPORAL : ANCHO_PERMANENTE;

  // Distancia desde la línea media hasta el centro de la pieza.
  let s = 0.03;
  for (let i = 1; i < n; i += 1) s += tabla[i] ?? 0;
  const ancho = anchoDePieza(fdi);
  s += ancho / 2;

  const { x: xAbs, z } = puntoEnArco(s);
  const derecha = cuadrante === 2 || cuadrante === 3;
  const x = derecha ? xAbs : -xAbs;
  const superior = arcadaDe(fdi) === "superior";

  return {
    x,
    y: superior ? SEPARACION_OCLUSAL : -SEPARACION_OCLUSAL,
    z,
    rotY: Math.atan(2 * K * x),
    ancho,
    invertido: superior,
  };
}

/** Longitud de arco (cm) desde la línea media hasta el final de la última pieza de un hemiarco. */
export function longitudHemiarco(temporal: boolean): number {
  const tabla = temporal ? ANCHO_TEMPORAL : ANCHO_PERMANENTE;
  return 0.03 + tabla.reduce((suma, ancho) => suma + ancho, 0);
}

/**
 * Festoneado de la encía a `s` cm de la línea media (por longitud de arco):
 * 0 en el centro de cada pieza (la encía baja hacia la raíz) y 1 en las papilas
 * entre piezas (la encía sube). Fuera del hemiarco devuelve 1.
 */
export function margenGingival(s: number, temporal: boolean): number {
  const tabla = temporal ? ANCHO_TEMPORAL : ANCHO_PERMANENTE;
  let inicio = 0.03;
  for (let n = 1; n < tabla.length; n += 1) {
    const ancho = tabla[n] ?? 0;
    if (s < inicio + ancho) {
      const t = (s - inicio) / ancho; // 0..1 dentro de la pieza
      return 0.5 + 0.5 * Math.cos(2 * Math.PI * t);
    }
    inicio += ancho;
  }
  return 1;
}

/** Eje local del diente (±x, ±y, ±z) hacia el que mira cada superficie. */
export function direccionDeZona(fdi: number, zona: Zona): [number, number, number] {
  switch (zona) {
    case "oclusal":
      return [0, 1, 0];
    case "vestibular":
      return [0, 0, 1];
    case "lingual":
      return [0, 0, -1];
    case "mesial":
      return [ladoMesialEnSvg(fdi) === "derecha" ? 1 : -1, 0, 0];
    case "distal":
      return [ladoMesialEnSvg(fdi) === "derecha" ? -1 : 1, 0, 0];
  }
}

// ---------------------------------------------------------------------------
// Apariencia según el estado clínico
// ---------------------------------------------------------------------------

export interface AparienciaPieza {
  /** Pérdida / pérdida por caries: se dibuja como fantasma translúcido. */
  ausente: boolean;
  /** Extracción indicada: la pieza sigue, pero se resalta. */
  extraccionIndicada: boolean;
  corona: boolean;
  endodoncia: boolean;
  protesis: boolean;
  /** Color por superficie (misma regla que el 2D) o `null` si no tiene color propio. */
  coloresZona: Record<Zona, string | null>;
}

function estadosDe(estado: EstadoDiente | undefined): Set<Condicion> {
  const todos = new Set<Condicion>();
  if (!estado) return todos;
  for (const c of estado.general?.estados ?? []) todos.add(c);
  for (const zona of ZONAS) {
    for (const c of estado.zonas[zona]?.estados ?? []) todos.add(c);
  }
  return todos;
}

export function apariencia(estado: EstadoDiente | undefined): AparienciaPieza {
  const estados = estadosDe(estado);
  const coloresZona = {} as Record<Zona, string | null>;
  for (const zona of ZONAS) {
    coloresZona[zona] = estado?.zonas[zona]?.color ?? estado?.general?.color ?? null;
  }
  return {
    ausente: estados.has("Pérdida") || estados.has("Pérdida por Caries"),
    extraccionIndicada: estados.has("Extracción Indicada"),
    corona: estados.has("Corona"),
    endodoncia: estados.has("Endodoncia"),
    protesis:
      estados.has("Prótesis Fija") || estados.has("Prótesis Removible") || estados.has("Prótesis Total"),
    coloresZona,
  };
}
