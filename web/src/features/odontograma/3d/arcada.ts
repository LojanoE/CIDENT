import { arcadaDe, direccionDeZona, posicionPieza } from "@cident/shared";

/**
 * Arcada elíptica y medidas de cada pieza. Solo es la parte visual: se calcula en milímetros
 * (las tablas anatómicas) y la salida pública va en cm, la unidad de la escena.
 * El marco de cada diente es el de siempre: oclusal hacia y=0, corona hacia -y, vestibular en +z;
 * la arcada superior se espeja en y desde el componente.
 */

export type TipoGeo = "inc" | "can" | "pm" | "mol";

/** Medidas en mm: ancho mesio-distal, alto de la corona, largo de la raíz, ancho vestíbulo-lingual. */
export interface EspecDiente {
  W: number;
  CH: number;
  RL: number;
  D: number;
  tipo: TipoGeo;
  raices: number;
}

type Fila = readonly [number, number, number, number, TipoGeo, number];

const PERM: Record<"U" | "L", readonly Fila[]> = {
  U: [
    [8.5, 10.5, 13, 7, "inc", 1],
    [6.5, 9, 13, 6, "inc", 1],
    [7.5, 10, 17, 8, "can", 1],
    [7, 8.5, 14, 9, "pm", 2],
    [6.5, 8.5, 14, 9, "pm", 1],
    [10, 7.5, 12.5, 11, "mol", 3],
    [9, 7, 11.5, 11, "mol", 3],
    [8.5, 6.5, 11, 10, "mol", 3],
  ],
  L: [
    [5, 9, 12.5, 6, "inc", 1],
    [5.5, 9.5, 14, 6.5, "inc", 1],
    [7, 11, 16, 7.5, "can", 1],
    [7, 8.5, 14, 7.5, "pm", 1],
    [7, 8, 14.5, 8, "pm", 1],
    [11, 7.5, 14, 10.5, "mol", 2],
    [10.5, 7, 13, 10, "mol", 2],
    [10, 7, 11, 9.5, "mol", 2],
  ],
};

const PRIM: Record<"U" | "L", readonly Fila[]> = {
  U: [
    [6.5, 6, 10, 5, "inc", 1],
    [5.1, 5.6, 11.4, 4, "inc", 1],
    [7, 6.5, 13.5, 7, "can", 1],
    [7.3, 5.1, 10, 8.5, "mol", 3],
    [8.2, 5.7, 11.7, 10, "mol", 3],
  ],
  L: [
    [4, 5, 9, 4, "inc", 1],
    [4.5, 5.2, 10, 4, "inc", 1],
    [5, 6, 11.5, 5.5, "can", 1],
    [7.7, 6, 9.8, 7, "mol", 2],
    [9.9, 5.5, 12.5, 9, "mol", 2],
  ],
};

function filas(superior: boolean, temporal: boolean): readonly Fila[] {
  return (temporal ? PRIM : PERM)[superior ? "U" : "L"];
}

function aEspec(f: Fila): EspecDiente {
  return { W: f[0], CH: f[1], RL: f[2], D: f[3], tipo: f[4], raices: f[5] };
}

export function especDe(fdi: number): EspecDiente {
  const f = filas(arcadaDe(fdi) === "superior", fdi >= 50)[(fdi % 10) - 1];
  if (!f) throw new Error(`FDI inválido: ${fdi}`);
  return aEspec(f);
}

/** Clave de caché de la geometría de una pieza (sin el lado mesial). */
export function claveDe(fdi: number): string {
  return `${arcadaDe(fdi) === "superior" ? "U" : "L"}${fdi >= 50 ? "t" : "p"}${fdi % 10}`;
}

// ---------------------------------------------------------------------------
// Curva de la arcada
// ---------------------------------------------------------------------------

interface PuntoArco {
  x: number;
  z: number;
  tx: number;
  tz: number;
}

/** Semielipse (a, b) que se abre hacia atrás con `flare`; devuelve punto y tangente por longitud de arco. */
function crearArco(a: number, b: number, flare: number, z0: number): (L: number) => PuntoArco {
  const pts: Array<[number, number]> = [[0, b]];
  for (let i = 1; i <= 300; i += 1) {
    const t = ((i / 300) * Math.PI) / 2;
    pts.push([a * Math.sin(t), b * Math.cos(t)]);
  }
  for (let i = 1; i <= 240; i += 1) {
    const d = i * 0.25;
    pts.push([a + flare * d, -d]);
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i += 1) {
    const p = pts[i]!;
    const q = pts[i - 1]!;
    cum.push(cum[i - 1]! + Math.hypot(p[0] - q[0], p[1] - q[1]));
  }
  return (L) => {
    const l = Math.max(0, L);
    let i = 1;
    while (i < cum.length - 1 && cum[i]! < l) i += 1;
    const p = pts[i]!;
    const q = pts[i - 1]!;
    const f = Math.min(1, (l - cum[i - 1]!) / (cum[i]! - cum[i - 1]! || 1));
    const x = q[0] + f * (p[0] - q[0]);
    const z = q[1] + f * (p[1] - q[1]);
    const tx = p[0] - q[0];
    const tz = p[1] - q[1];
    const largo = Math.hypot(tx, tz) || 1;
    return { x, z: z + z0, tx: tx / largo, tz: tz / largo };
  };
}

export interface MarcoArco {
  /** Punto de la curva (x, z). */
  px: number;
  pz: number;
  /** Tangente (x, z) y normal hacia vestibular (x, z); `Ls` con signo: + lado +x, - lado -x. */
  tx: number;
  tz: number;
  nx: number;
  nz: number;
}

export type Arco = (L: number) => PuntoArco;

export function marcoEn(arco: Arco, Ls: number): MarcoArco {
  const sg = Ls < 0 ? -1 : 1;
  const p = arco(Math.abs(Ls));
  return { px: sg * p.x, pz: p.z, tx: sg * p.tx, tz: p.tz, nx: -sg * p.tz, nz: p.tx };
}

const ARCOS = {
  adulto: { U: [25, 28, 0.1, 0], L: [21.5, 15.5, 0.1, 5.2] },
  temporal: { U: [19, 21, 0.1, 0], L: [16, 12, 0.1, 4.2] },
} as const;

/** Pieza dentro de la disposición de una arcada (mm). */
export interface PiezaLayout {
  L0: number;
  L1: number;
  /** Centro de la pieza a lo largo de la curva. */
  c: number;
  D: number;
  RL: number;
  ant: boolean;
  /** Altura (y) del cuello de la pieza en el marco de la arcada. */
  cej: number;
}

export interface DisposicionArcada {
  arco: Arco;
  piezas: PiezaLayout[];
  /** Largo total del hemiarco (mm), con un margen para la encía. */
  largo: number;
}

const BRECHA = 0.12;
const ALZA_ANTERIORES = { permanente: 1.8, temporal: 1.0 };

/** Altura de la cara oclusal/borde incisal sobre el cuello (mm), según el tipo de pieza. */
export function alturaTope(spec: EspecDiente): number {
  const yEdge = spec.CH * 0.78;
  const cuspH = spec.CH * 0.22;
  switch (spec.tipo) {
    case "inc":
      return yEdge + cuspH;
    case "can":
      return yEdge + cuspH * 1.25;
    default:
      // t = 1, th = 0: h = 0.28 y el modulador vale 1.
      return yEdge + cuspH * 0.28;
  }
}

function alzaDe(spec: EspecDiente, superior: boolean, temporal: boolean): number {
  const anterior = spec.tipo === "inc" || spec.tipo === "can";
  if (!superior || !anterior) return 0;
  return temporal ? ALZA_ANTERIORES.temporal : ALZA_ANTERIORES.permanente;
}

const disposiciones = new Map<string, DisposicionArcada>();

export function disposicionArcada(superior: boolean, temporal: boolean): DisposicionArcada {
  const clave = `${superior ? "U" : "L"}${temporal ? "t" : "p"}`;
  const hecha = disposiciones.get(clave);
  if (hecha) return hecha;

  const [a, b, flare, z0] = ARCOS[temporal ? "temporal" : "adulto"][superior ? "U" : "L"];
  const arco = crearArco(a, b, flare, z0);
  let acumulado = 0;
  const piezas: PiezaLayout[] = filas(superior, temporal).map((fila) => {
    const spec = aEspec(fila);
    const L0 = acumulado;
    const L1 = acumulado + spec.W;
    acumulado = L1 + BRECHA;
    return {
      L0,
      L1,
      c: (L0 + L1) / 2,
      D: spec.D,
      RL: spec.RL,
      ant: spec.tipo === "inc" || spec.tipo === "can",
      cej: -alturaTope(spec) + alzaDe(spec, superior, temporal),
    };
  });
  const disp = { arco, piezas, largo: acumulado + 1.6 };
  disposiciones.set(clave, disp);
  return disp;
}

export interface Colocacion {
  spec: EspecDiente;
  /** Posición del cuello (cm) en el plano de la arcada; la altura va aparte. */
  x: number;
  z: number;
  /** Altura (cm) del cuello respecto del plano oclusal de la arcada. */
  y: number;
  rotY: number;
  /** Inclinación vestibular (rad) de los anteriores, alrededor del eje mesio-distal. */
  inclinacion: number;
  /** Altura de la cara oclusal sobre el cuello (cm). */
  tope: number;
  /** +1 si la cara mesial mira hacia +x del marco local, -1 si hacia -x. */
  mesialDir: 1 | -1;
}

const MM = 0.1;
/** Separación vertical (cm) de cada mandíbula respecto del plano oclusal. */
export const JUEGO_MANDIBULAR = 0.06;

export function colocacion(fdi: number): Colocacion {
  const superior = arcadaDe(fdi) === "superior";
  const temporal = fdi >= 50;
  const disp = disposicionArcada(superior, temporal);
  const idx = (fdi % 10) - 1;
  const pieza = disp.piezas[idx];
  if (!pieza) throw new Error(`FDI inválido: ${fdi}`);
  const spec = especDe(fdi);

  const lado = posicionPieza(fdi).x < 0 ? -1 : 1;
  const m = marcoEn(disp.arco, lado * pieza.c);
  // Eje mesio-distal local: a lo largo de la curva en el lado +x y en sentido contrario en el -x.
  const xx = lado > 0 ? m.tx : -m.tx;
  const xz = lado > 0 ? m.tz : -m.tz;

  const anterior = pieza.ant;
  const base = superior ? 0.2 : 0.12;
  return {
    spec,
    x: m.px * MM,
    z: m.pz * MM,
    // La cara oclusal está en y=0 de la geometría: solo falta la separación entre mandíbulas y el
    // alza de los anteriores superiores (que cuelgan más abajo que los posteriores).
    y: superior ? JUEGO_MANDIBULAR - alzaDe(spec, true, temporal) * MM : -JUEGO_MANDIBULAR,
    rotY: Math.atan2(-xz, xx),
    inclinacion: anterior ? base * (spec.tipo === "can" ? 0.5 : 1) : 0,
    tope: alturaTope(spec) * MM,
    mesialDir: direccionDeZona(fdi, "mesial")[0] >= 0 ? 1 : -1,
  };
}
