import type { TipoPieza } from "@cident/shared";
import { BufferGeometry, CylinderGeometry, Float32BufferAttribute } from "three";

/** Medidas (cm) de la corona por tipo de pieza; el ancho mesio-distal sale de `posicionPieza`. */
export const DIMENSIONES: Record<TipoPieza, { alto: number; profundidad: number; raiz: number }> = {
  incisivo: { alto: 1.0, profundidad: 0.7, raiz: 1.2 },
  canino: { alto: 1.1, profundidad: 0.85, raiz: 1.5 },
  premolar: { alto: 0.8, profundidad: 0.9, raiz: 1.1 },
  molar: { alto: 0.75, profundidad: 1.05, raiz: 0.95 },
};

/**
 * Orden de los 6 grupos de la corona (un material por cara): +x, -x, +y, -y, +z, -z.
 * `Diente3D` asocia cada uno a una zona clínica (el -y es el cuello, sin zona).
 */
export const EJES_GRUPOS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const G_X_POS = 0;
const G_X_NEG = 1;
const G_OCLUSAL = 2;
const G_CERVICAL = 3;
const G_Z_POS = 4;
const G_Z_NEG = 5;

// Resolución de la malla de la corona.
const ANGULOS = 40;
const ANILLOS_PARED = 10;
const ANILLOS_CAPA = 7;
/** Exponente de la superelipse de cada sección (2 = elipse, mayor = más "cuadrada"). */
const EXPONENTE = 2.5;

type Claves = ReadonlyArray<readonly [number, number]>;

interface Perfil {
  /** Altura (en la corona unitaria) de la cara oclusal en su borde. */
  yTop: number;
  /** Semiancho mesio-distal relativo según la altura (0 = cuello, 1 = oclusal). */
  ancho: Claves;
  /** Semiprofundidad relativa del lado vestibular y del lingual. */
  vest: Claves;
  ling: Claves;
}

const PERFILES: Record<TipoPieza, Perfil> = {
  molar: {
    yTop: 0.34,
    ancho: [[0, 0.68], [0.7, 0.98], [1, 0.9]],
    vest: [[0, 0.75], [0.3, 1], [1, 0.86]],
    ling: [[0, 0.75], [0.5, 1], [1, 0.8]],
  },
  premolar: {
    yTop: 0.34,
    ancho: [[0, 0.66], [0.7, 0.97], [1, 0.85]],
    vest: [[0, 0.75], [0.3, 1], [1, 0.8]],
    ling: [[0, 0.75], [0.5, 0.98], [1, 0.7]],
  },
  canino: {
    yTop: 0.26,
    ancho: [[0, 0.62], [0.6, 0.97], [1, 0.8]],
    vest: [[0, 0.7], [0.3, 1], [1, 0.6]],
    ling: [[0, 0.7], [0.3, 0.95], [1, 0.5]],
  },
  incisivo: {
    yTop: 0.42,
    ancho: [[0, 0.6], [0.65, 0.98], [1, 0.95]],
    vest: [[0, 0.7], [0.3, 0.95], [1, 0.85]],
    ling: [[0, 0.7], [0.28, 0.95], [0.7, 0.6], [1, 0.4]],
  },
};

function suavizar(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function interpolar(t: number, claves: Claves): number {
  const primera = claves[0]!;
  if (t <= primera[0]) return primera[1];
  for (let i = 1; i < claves.length; i += 1) {
    const [t1, v1] = claves[i]!;
    if (t <= t1) {
      const [t0, v0] = claves[i - 1]!;
      return v0 + (v1 - v0) * suavizar((t - t0) / (t1 - t0));
    }
  }
  return claves[claves.length - 1]![1];
}

/** Potencia con signo: da la sección superelíptica a partir de cos/sen. */
function potenciaConSigno(v: number): number {
  return Math.sign(v) * Math.abs(v) ** (2 / EXPONENTE);
}

/** Ruido determinista barato (±1) para variar el color de un vértice a otro. */
function ruido(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

const gauss = (d2: number, sigma: number) => Math.exp(-d2 / (2 * sigma * sigma));

/**
 * Relieve de la cara oclusal sobre el borde de la corona (`u`, `v` normalizados a ±1 en
 * mesio-distal y vestíbulo-lingual) y cuánto se tiñen sus fisuras (0..1).
 */
function relieve(tipo: TipoPieza, u: number, v: number): { h: number; fisura: number } {
  switch (tipo) {
    case "molar": {
      const cuspide = (cu: number, cv: number, amp: number) => amp * gauss((u - cu) ** 2 + (v - cv) ** 2, 0.34);
      const centro = Math.exp(-(u * u + v * v) / 0.12);
      const surcos = Math.exp(-(u * u) / 0.015) + Math.exp(-(v * v) / 0.015);
      return {
        h:
          cuspide(0.45, 0.45, 0.15) +
          cuspide(-0.45, 0.45, 0.14) +
          cuspide(0.45, -0.45, 0.13) +
          cuspide(-0.45, -0.45, 0.13) -
          0.07 * centro -
          0.03 * surcos,
        fisura: Math.min(1, 0.9 * centro + 0.55 * surcos),
      };
    }
    case "premolar": {
      const cuspide = (cv: number, amp: number) => amp * gauss(((u / 0.5) ** 2) * 0.12 + (v - cv) ** 2, 0.3);
      const surco = Math.exp(-(v * v) / 0.02);
      return {
        h: cuspide(0.5, 0.2) + cuspide(-0.5, 0.14) - 0.06 * surco * (1 - 0.3 * Math.abs(u)),
        fisura: Math.min(1, surco),
      };
    }
    case "canino": {
      const r = Math.hypot(u / 0.9, v / 0.9);
      return { h: 0.24 * Math.max(0, 1 - r) ** 1.2, fisura: 0 };
    }
    case "incisivo":
      return { h: 0.04 * (1 - 1.5 * (v - 0.15) ** 2), fisura: 0 };
  }
}

/** Altura (corona unitaria) del centro de la cara oclusal; sirve para anclar marcadores. */
export function alturaCentroOclusal(tipo: TipoPieza): number {
  return PERFILES[tipo].yTop + relieve(tipo, 0, 0).h;
}

type Rgb = readonly [number, number, number];
const DENTINA_CUELLO: Rgb = [0.86, 0.78, 0.59];
const ESMALTE: Rgb = [0.95, 0.93, 0.89];
const ESMALTE_TRASLUCIDO: Rgb = [0.84, 0.87, 0.88];
const FISURA: Rgb = [0.8, 0.7, 0.48];

function mezclar(a: Rgb, b: Rgb, t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const coronas = new Map<TipoPieza, BufferGeometry>();
let raiz: BufferGeometry | null = null;
let conducto: CylinderGeometry | null = null;

/**
 * Corona unitaria (centrada en el origen, caja de lado ≈1) con anatomía propia de cada tipo:
 * secciones superelípticas apiladas desde el cuello, cuello estrecho, abombamiento a
 * distinta altura vestibular/lingual y cara oclusal con cúspides y fisuras. Los triángulos se
 * agrupan en 6 caras (ver `EJES_GRUPOS`) y cada vértice lleva color (degradado dentina→esmalte).
 * Se cachea: las 32 piezas comparten 4 geometrías y se escalan con `scale`.
 */
export function geometriaCorona(tipo: TipoPieza): BufferGeometry {
  const cacheada = coronas.get(tipo);
  if (cacheada) return cacheada;

  const perfil = PERFILES[tipo];
  const M = ANGULOS;
  const P = ANILLOS_PARED;
  const K = ANILLOS_CAPA;
  const traslucido = tipo === "incisivo" || tipo === "canino";

  const pos: number[] = [];
  const col: number[] = [];
  const empujar = (x: number, y: number, z: number, c: readonly [number, number, number]) => {
    pos.push(x, y, z);
    col.push(c[0], c[1], c[2]);
  };

  // Pared: anillos 0..P desde el cuello (y = -0.5) hasta el borde oclusal (y = yTop).
  const borde: Array<{ x: number; z: number }> = [];
  for (let i = 0; i <= P; i += 1) {
    const t = i / P;
    const y = -0.5 + t * (perfil.yTop + 0.5);
    const a = 0.5 * interpolar(t, perfil.ancho);
    const bVest = interpolar(t, perfil.vest);
    const bLing = interpolar(t, perfil.ling);
    for (let j = 0; j < M; j += 1) {
      const th = (2 * Math.PI * j) / M;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const b = 0.5 * (bLing + (bVest - bLing) * suavizar(0.5 + 0.75 * s));
      const x = a * potenciaConSigno(c);
      const z = b * potenciaConSigno(s);
      if (i === P) borde.push({ x, z });

      let color = mezclar(DENTINA_CUELLO, ESMALTE, suavizar((t - 0.04) / 0.5));
      if (traslucido) color = mezclar(color, ESMALTE_TRASLUCIDO, 0.65 * suavizar((t - 0.78) / 0.22));
      const n = 0.012 * ruido(i, j);
      empujar(x, y, z, [color[0] + n, color[1] + n, color[2] + n]);
    }
  }

  // Cara oclusal: anillos concéntricos hacia el centro, con el relieve del tipo.
  for (let k = 1; k <= K; k += 1) {
    const rho = 1 - k / (K + 1);
    const envolvente = suavizar((1 - rho) / 0.3);
    for (let j = 0; j < M; j += 1) {
      const { x: xe, z: ze } = borde[j]!;
      const x = rho * xe;
      const z = rho * ze;
      const { h, fisura } = relieve(tipo, x / 0.5, z / 0.5);
      let color: [number, number, number] = traslucido ? [...ESMALTE_TRASLUCIDO] : [...ESMALTE];
      color = mezclar(color, FISURA, 0.8 * fisura * envolvente);
      const n = 0.012 * ruido(P + k, j);
      empujar(x, perfil.yTop + h * envolvente, z, [color[0] + n, color[1] + n, color[2] + n]);
    }
  }
  const centro = pos.length / 3;
  {
    const { h, fisura } = relieve(tipo, 0, 0);
    const color = mezclar(traslucido ? ESMALTE_TRASLUCIDO : ESMALTE, FISURA, 0.8 * fisura);
    empujar(0, perfil.yTop + h, 0, color);
  }
  const fondo = pos.length / 3;
  empujar(0, -0.5, 0, DENTINA_CUELLO);

  // Triángulos clasificados por cara.
  const porGrupo: number[][] = [[], [], [], [], [], []];
  const anillo = (r: number, j: number) => r * M + (((j % M) + M) % M);
  const quad = (r: number, j: number, grupo: number) => {
    const A = anillo(r, j);
    const B = anillo(r, j + 1);
    const C = anillo(r + 1, j);
    const D = anillo(r + 1, j + 1);
    porGrupo[grupo]!.push(A, C, B, B, C, D);
  };

  for (let j = 0; j < M; j += 1) {
    // Cuello: tapa inferior y la primera banda de la pared.
    porGrupo[G_CERVICAL]!.push(anillo(0, j), anillo(0, j + 1), fondo);

    const thc = (2 * Math.PI * (j + 0.5)) / M;
    const c = Math.cos(thc);
    const s = Math.sin(thc);
    const lateral =
      Math.abs(c) > Math.abs(s) ? (c > 0 ? G_X_POS : G_X_NEG) : s > 0 ? G_Z_POS : G_Z_NEG;

    for (let i = 0; i < P; i += 1) {
      const grupo = i === 0 ? G_CERVICAL : i === P - 1 ? G_OCLUSAL : lateral;
      quad(i, j, grupo);
    }
    // Cara oclusal: de anillo a anillo y el abanico final al centro.
    for (let r = P; r < P + K; r += 1) quad(r, j, G_OCLUSAL);
    porGrupo[G_OCLUSAL]!.push(anillo(P + K, j), centro, anillo(P + K, j + 1));
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  const indices: number[] = [];
  porGrupo.forEach((tris, grupo) => {
    if (tris.length === 0) return;
    g.addGroup(indices.length, tris.length, grupo);
    for (const idx of tris) indices.push(idx);
  });
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  coronas.set(tipo, g);
  return g;
}

/**
 * Raíz unitaria (alto 1 centrado en el origen, radio superior 0.5): se afina hacia un ápice
 * redondeado y se curva levemente hacia +x (la raíz se espeja con `scale.x` para curvar
 * hacia distal). Apunta hacia -y al escalarla.
 */
export function geometriaRaiz(): BufferGeometry {
  if (raiz) return raiz;
  const SEGMENTOS = 14;
  const ANILLOS = 12;
  const pos: number[] = [];
  for (let i = 0; i <= ANILLOS; i += 1) {
    const s = i / ANILLOS;
    const y = 0.5 - s;
    const r = 0.5 * (1 - 0.8 * s) * Math.sqrt(Math.max(0, 1 - s ** 6));
    const desvio = 0.45 * s * s;
    for (let j = 0; j < SEGMENTOS; j += 1) {
      const th = (2 * Math.PI * j) / SEGMENTOS;
      pos.push(desvio + r * Math.cos(th), y, r * Math.sin(th));
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < ANILLOS; i += 1) {
    for (let j = 0; j < SEGMENTOS; j += 1) {
      const A = i * SEGMENTOS + j;
      const B = i * SEGMENTOS + ((j + 1) % SEGMENTOS);
      const C = (i + 1) * SEGMENTOS + j;
      const D = (i + 1) * SEGMENTOS + ((j + 1) % SEGMENTOS);
      idx.push(A, B, C, B, D, C);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  raiz = g;
  return g;
}

/** Conducto radicular unitario (alto 1, radio superior 0.5), para la endodoncia. */
export function geometriaConducto(): CylinderGeometry {
  conducto ??= new CylinderGeometry(0.5, 0.15, 1, 8, 1);
  return conducto;
}

/** Raíces de cada tipo: desplazamiento relativo al ancho y grosor relativo. */
export function raicesDe(tipo: TipoPieza, superior: boolean): ReadonlyArray<{ dx: number; grosor: number }> {
  if (tipo !== "molar") return [{ dx: 0, grosor: 0.6 }];
  return superior
    ? [
        { dx: -0.3, grosor: 0.3 },
        { dx: 0, grosor: 0.3 },
        { dx: 0.3, grosor: 0.3 },
      ]
    : [
        { dx: -0.25, grosor: 0.42 },
        { dx: 0.25, grosor: 0.42 },
      ];
}
