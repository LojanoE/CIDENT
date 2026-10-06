import { BufferGeometry, Color, Float32BufferAttribute, SRGBColorSpace } from "three";
import type { EspecDiente } from "./arcada";
import { alturaTope, claveDe, especDe } from "./arcada";

/**
 * Diente procedural de una sola malla (raíz + corona + cúspides). Se arma en milímetros con las
 * proporciones de cada tipo de pieza y se escala a cm (unidad de la escena). El marco local es el
 * de siempre: cara oclusal en y=0, corona hacia -y y raíz más abajo; vestibular en +z.
 *
 * Cada triángulo pertenece a una de 6 regiones, que son los grupos de la malla (materialIndex):
 * 0 raíz, 1 oclusal, 2 vestibular, 3 lingual, 4 mesial, 5 distal.
 */

export const REGIONES = 6;
export const R_RAIZ = 0;

const MM = 0.1;
const NU = 48;
const NR = 14;
const NC = 14;
const NK = 10;

const lin = (r: number, g: number, b: number): Color => new Color().setRGB(r, g, b, SRGBColorSpace);
const C_ROOT = lin(0.86, 0.75, 0.57);
const C_CERV = lin(0.92, 0.85, 0.7);
const C_BODY = lin(0.96, 0.94, 0.88);
const C_EDGE = lin(0.88, 0.91, 0.93);
const C_OCC = lin(0.95, 0.93, 0.86);
const C_FISURA = lin(0.86, 0.8, 0.66);
const C_FOSA = lin(0.84, 0.77, 0.62);

export interface DienteGeo {
  geometry: BufferGeometry;
  /** Altura (cm) de la cara oclusal sobre el cuello. */
  tope: number;
}

function construir(spec: EspecDiente, mesialDir: 1 | -1): DienteGeo {
  const { W, CH, RL, D, tipo, raices } = spec;
  const anterior = tipo === "inc" || tipo === "can";
  const pe = tipo === "mol" ? 0.62 : tipo === "pm" ? 0.74 : 0.86;
  const yEdge = CH * 0.78;
  const cuspH = CH * 0.22;

  const pos: number[] = [];
  const reg: number[] = [];
  const col: number[] = [];
  const tmp = new Color();

  const regionLado = (th: number): number => {
    const c = Math.cos(th);
    const s = Math.sin(th);
    if (Math.abs(s) >= Math.abs(c)) return s > 0 ? 2 : 3;
    return c * mesialDir > 0 ? 4 : 5;
  };
  const anillo = (th: number, a: number, b: number): [number, number] => {
    const c = Math.cos(th);
    const s = Math.sin(th);
    return [a * Math.sign(c) * Math.abs(c) ** pe, b * Math.sign(s) * Math.abs(s) ** pe];
  };
  const patron = (th: number): number => (tipo === "pm" ? 0.5 - 0.5 * Math.cos(2 * th) : 0.5 - 0.5 * Math.cos(4 * th));

  // Ápice.
  pos.push(0, -RL - 0.4, 0);
  reg.push(0);
  col.push(C_ROOT.r, C_ROOT.g, C_ROOT.b);

  // Raíz.
  for (let k = 1; k <= NR; k += 1) {
    const s = k / NR;
    const y = -RL * (1 - s);
    const f = Math.max(0.06, s ** 0.55);
    const ra = (W / 2) * 0.68 * f;
    const rb = (D / 2) * 0.8 * f;
    const kk = raices > 1 ? (tipo === "pm" ? 0.38 : 0.55) * Math.max(0, 1 - s / 0.78) ** 0.7 : 0;
    for (let i = 0; i < NU; i += 1) {
      const th = (i / NU) * Math.PI * 2;
      let m = 1;
      if (raices === 2 && tipo === "mol") m = 1 - kk * (0.5 - 0.5 * Math.cos(2 * th));
      else if (raices === 2) m = 1 - kk * (0.5 + 0.5 * Math.cos(2 * th));
      else if (raices === 3) m = 1 - kk * (0.5 + 0.5 * Math.cos(3 * th + Math.PI / 2));
      const [x, z] = anillo(th, ra * m, rb * m);
      pos.push(x, y, z);
      reg.push(0);
      tmp.copy(C_ROOT).lerp(C_CERV, s ** 6 * 0.5);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }

  // Corona.
  for (let k = 1; k <= NC; k += 1) {
    const s = k / NC;
    const y = yEdge * s;
    let fw = 0.7 + 0.3 * Math.sin((Math.PI / 2) * Math.min(1, s / 0.5)) - (s > 0.5 ? 0.1 * ((s - 0.5) / 0.5) ** 2 : 0);
    const bulge = 0.8 + 0.2 * Math.sin((Math.PI / 2) * Math.min(1, s / 0.38));
    let fd: number;
    if (tipo === "inc") fd = bulge * (1 - 0.7 * s ** 1.6);
    else if (tipo === "can") fd = bulge * (1 - 0.42 * s ** 1.6);
    else fd = bulge - (s > 0.4 ? 0.13 * ((s - 0.4) / 0.6) ** 2 : 0);
    if (tipo === "can") fw *= 1 - 0.1 * s;
    for (let i = 0; i < NU; i += 1) {
      const th = (i / NU) * Math.PI * 2;
      const [x, z] = anillo(th, (W / 2) * fw, (D / 2) * fd);
      pos.push(x, y, z);
      reg.push(regionLado(th));
      if (s < 0.35) tmp.copy(C_CERV).lerp(C_BODY, s / 0.35);
      else tmp.copy(C_BODY).lerp(anterior ? C_EDGE : C_OCC, ((s - 0.35) / 0.65) ** 2);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }

  // Cara oclusal / borde incisal.
  const fwE = 0.9;
  const bE = tipo === "inc" ? 1 - 0.7 : tipo === "can" ? 1 - 0.42 : 1 - 0.13;
  const aE = (W / 2) * fwE * (tipo === "can" ? 0.9 : 1);
  const dE = (D / 2) * bE;
  const capY = (t: number, th: number): number => {
    if (tipo === "inc") return yEdge + cuspH * Math.sin((t * Math.PI) / 2);
    if (tipo === "can") return yEdge + cuspH * 1.25 * t ** 0.85 * (1 - 0.15 * Math.abs(Math.cos(th)) * (1 - t));
    const pat = patron(th);
    let h: number;
    let w: number;
    if (t < 0.38) {
      h = Math.sin(((Math.PI / 2) * t) / 0.38);
      w = t / 0.38;
    } else {
      const u = (t - 0.38) / 0.62;
      h = 1 - 0.72 * u ** 1.4;
      w = 1 - u * u;
    }
    return yEdge + cuspH * h * (1 + w * (0.3 + 0.7 * pat - 1));
  };
  for (let k = 1; k <= NK; k += 1) {
    const t = k / (NK + 1);
    let ga: number;
    let gb: number;
    if (tipo === "inc") {
      ga = 1 - t ** 3.2;
      gb = 1 - t;
    } else if (tipo === "can") {
      ga = 1 - t;
      gb = 1 - t;
    } else {
      ga = 1 - t ** 1.15;
      gb = ga;
    }
    for (let i = 0; i < NU; i += 1) {
      const th = (i / NU) * Math.PI * 2;
      const [x, z] = anillo(th, aE * ga, dE * gb);
      pos.push(x, capY(t, th), z);
      const oclusal = anterior ? t > 0.45 : t > 0.22;
      reg.push(oclusal ? 1 : regionLado(th));
      tmp.copy(anterior ? C_EDGE : C_OCC);
      if (!anterior) tmp.lerp(C_FISURA, (1 - patron(th)) * Math.max(0, t - 0.4) * 0.9);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  const topY = capY(1, 0);
  pos.push(0, topY, 0);
  reg.push(1);
  const cima = anterior ? C_EDGE : C_FOSA;
  col.push(cima.r, cima.g, cima.b);

  // Triángulos por grupo (región mayoritaria de sus vértices).
  const porGrupo: number[][] = Array.from({ length: REGIONES }, () => []);
  const tri = (a: number, b: number, c: number): void => {
    const ra = reg[a]!;
    const rb = reg[b]!;
    const rc = reg[c]!;
    const grupo = ra === rb || ra === rc ? ra : rb === rc ? rb : ra;
    porGrupo[grupo]!.push(a, b, c);
  };
  const anillos = NR + NC + NK;
  const ring0 = 1;
  for (let i = 0; i < NU; i += 1) tri(0, ring0 + i, ring0 + ((i + 1) % NU));
  for (let r = 0; r < anillos - 1; r += 1) {
    const b0 = ring0 + r * NU;
    const b1 = ring0 + (r + 1) * NU;
    for (let i = 0; i < NU; i += 1) {
      const i2 = (i + 1) % NU;
      tri(b0 + i, b1 + i, b1 + i2);
      tri(b0 + i, b1 + i2, b0 + i2);
    }
  }
  const cumbre = pos.length / 3 - 1;
  const ultimo = ring0 + (anillos - 1) * NU;
  for (let i = 0; i < NU; i += 1) tri(ultimo + i, cumbre, ultimo + ((i + 1) % NU));

  // Se baja la cara oclusal a y=0 y se pasa a cm.
  const final = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    final[i] = pos[i]! * MM;
    final[i + 1] = (pos[i + 1]! - topY) * MM;
    final[i + 2] = pos[i + 2]! * MM;
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(final, 3));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  const indices: number[] = [];
  for (let grupo = 0; grupo < REGIONES; grupo += 1) {
    const lista = porGrupo[grupo]!;
    if (lista.length === 0) continue;
    g.addGroup(indices.length, lista.length, grupo);
    for (const v of lista) indices.push(v);
  }
  g.setIndex(indices);
  g.computeVertexNormals();
  return { geometry: g, tope: alturaTope(spec) * MM };
}

// 32 permanentes + 20 temporales como máximo; la geometría se comparte entre piezas simétricas.
const cache = new Map<string, DienteGeo>();

/** Geometría de una pieza. `mesialDir`: hacia dónde cae la cara mesial en el eje x local. */
export function geometriaDiente(fdi: number, mesialDir: 1 | -1): DienteGeo {
  const clave = `${claveDe(fdi)}|${mesialDir}`;
  let g = cache.get(clave);
  if (!g) {
    g = construir(especDe(fdi), mesialDir);
    cache.set(clave, g);
  }
  return g;
}
