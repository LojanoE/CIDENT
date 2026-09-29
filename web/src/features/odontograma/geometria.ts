import type { PosicionGeometrica, TipoOdontograma } from "@cident/shared";
import { FDI_PERMANENTES, FDI_TEMPORALES } from "@cident/shared";

/** Lado del cuadrado exterior de un diente, en unidades del viewBox. */
export const SIZE = 40;
/** Separación horizontal entre dientes contiguos. */
export const GAP = 10;
export const PASO = SIZE + GAP;
/** Alto de una fila de dientes: el diente más la etiqueta FDI que lleva debajo. */
export const ALTO_CELDA = SIZE + 18;
/** Margen del viewBox: evita que el trazo de la zona seleccionada quede recortado. */
export const MARGEN = 4;

/** Grosor de la banda perimetral (las cuatro zonas laterales); el resto es el centro oclusal. */
const BANDA = SIZE * 0.25;

/**
 * Cinco polígonos por diente: el centro (oclusal/incisal) como cuadrado y cuatro
 * trapecios formados por las diagonales del cuadrado exterior. Derivados de `SIZE`
 * para que el diente pueda dibujarse a otra escala sin tocar los literales.
 * `zonaDeLado` (packages/shared) traduce cada posición a su zona clínica real.
 */
export const POLIGONOS: readonly { posicion: PosicionGeometrica; puntos: string; centro: [number, number] }[] = [
  {
    posicion: "centro",
    puntos: `${BANDA},${BANDA} ${SIZE - BANDA},${BANDA} ${SIZE - BANDA},${SIZE - BANDA} ${BANDA},${SIZE - BANDA}`,
    centro: [SIZE / 2, SIZE / 2],
  },
  {
    posicion: "arriba",
    puntos: `0,0 ${SIZE},0 ${SIZE - BANDA},${BANDA} ${BANDA},${BANDA}`,
    centro: [SIZE / 2, BANDA / 2],
  },
  {
    posicion: "derecha",
    puntos: `${SIZE},0 ${SIZE},${SIZE} ${SIZE - BANDA},${SIZE - BANDA} ${SIZE - BANDA},${BANDA}`,
    centro: [SIZE - BANDA / 2, SIZE / 2],
  },
  {
    posicion: "abajo",
    puntos: `0,${SIZE} ${SIZE},${SIZE} ${SIZE - BANDA},${SIZE - BANDA} ${BANDA},${SIZE - BANDA}`,
    centro: [SIZE / 2, SIZE - BANDA / 2],
  },
  {
    posicion: "izquierda",
    puntos: `0,0 0,${SIZE} ${BANDA},${SIZE - BANDA} ${BANDA},${BANDA}`,
    centro: [BANDA / 2, SIZE / 2],
  },
];

export function secuenciaDe(tipo: TipoOdontograma): readonly number[] {
  return tipo === "adulto" ? FDI_PERMANENTES : FDI_TEMPORALES;
}

/** Cuadrante (1–4 adultos, 5–8 temporales) según el primer dígito FDI. */
export function cuadranteFdi(fdi: number): number {
  return Math.floor(fdi / 10);
}

/**
 * Disposición 2×2 de los cuadrantes tal como los dibuja la vista de arcadas completas
 * (fila superior, fila inferior; izquierda a derecha). Se deriva de la secuencia FDI de
 * `packages/shared` para que el mapa nunca contradiga a lo que el odontólogo ve en el
 * odontograma completo.
 */
export function mapaCuadrantes(tipo: TipoOdontograma): [[number, number], [number, number]] {
  const secuencia = secuenciaDe(tipo);
  const mitad = secuencia.length / 2;
  const cuarto = mitad / 2;
  const q = (indice: number) => cuadranteFdi(secuencia[indice]!);
  return [
    [q(0), q(cuarto)],
    [q(mitad), q(mitad + cuarto)],
  ];
}

export function cuadrantesDe(tipo: TipoOdontograma): number[] {
  return mapaCuadrantes(tipo).flat();
}

/** Dientes de un cuadrante, en el orden en que se dibujan en la arcada. */
export function dientesDeCuadrante(tipo: TipoOdontograma, cuadrante: number): number[] {
  return secuenciaDe(tipo).filter((fdi) => cuadranteFdi(fdi) === cuadrante);
}

/** «11–18»: rango numérico de un cuadrante, de menor a mayor. */
export function rangoDeCuadrante(tipo: TipoOdontograma, cuadrante: number): string {
  const dientes = dientesDeCuadrante(tipo, cuadrante);
  return `${Math.min(...dientes)}–${Math.max(...dientes)}`;
}

/** Cuadrante inicial al abrir el modo móvil: el primero que dibuja la arcada. */
export function cuadranteInicial(tipo: TipoOdontograma): number {
  return mapaCuadrantes(tipo)[0][0];
}
