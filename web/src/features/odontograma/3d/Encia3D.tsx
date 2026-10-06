import { useEffect, useMemo } from "react";
import { BufferGeometry, Color, Float32BufferAttribute, SRGBColorSpace } from "three";
import type { DisposicionArcada } from "./arcada";
import { JUEGO_MANDIBULAR, disposicionArcada, marcoEn } from "./arcada";
import { materialEncia } from "./materiales";

/**
 * Encía de una arcada: un tubo de sección superelíptica barrido a lo largo de la curva de los
 * dientes, que sube en las papilas y se afina en los extremos. Se arma en mm en el marco de la
 * mandíbula (cuello de los dientes hacia arriba) y se pasa a cm; la superior se espeja en y.
 */

const MM = 0.1;
const SECCION = 36;

const lin = (r: number, g: number, b: number): Color => new Color().setRGB(r, g, b, SRGBColorSpace);
const C_ALTO = lin(0.9, 0.58, 0.58);
const C_MEDIO = lin(0.84, 0.45, 0.48);
const C_BAJO = lin(0.7, 0.27, 0.33);

function geometriaEncia({ arco, piezas, largo }: DisposicionArcada): BufferGeometry {
  const S = Math.ceil((largo * 2) / 0.35);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const tmp = new Color();

  const cercana = (L: number) => {
    const a = Math.abs(L);
    let i = 0;
    while (i < piezas.length - 1 && piezas[i]!.c < a) i += 1;
    const t1 = piezas[Math.max(0, i - 1)]!;
    const t2 = piezas[i]!;
    const f = t2 === t1 ? 0 : Math.min(1, Math.max(0, (a - t1.c) / (t2.c - t1.c)));
    const propia = piezas.find((t) => a >= t.L0 - 0.05 && a <= t.L1 + 0.05) ?? piezas[piezas.length - 1]!;
    return { D: t1.D + (t2.D - t1.D) * f, cej: t1.cej + (t2.cej - t1.cej) * f, propia };
  };
  const yFondo = Math.min(...piezas.map((t) => t.cej - t.RL)) - 1.2;

  for (let k = 0; k <= S; k += 1) {
    const L = -largo + (2 * largo * k) / S;
    const fr = marcoEn(arco, L === 0 ? 0.0001 : L);
    const t = cercana(L);
    const u = (Math.abs(L) - t.propia.L0) / (t.propia.L1 - t.propia.L0);
    const pap = ((Math.cos(2 * Math.PI * Math.min(1, Math.max(0, u))) + 1) / 2) ** 1.4;
    let tope = t.cej + 0.9 + (t.propia.ant ? 2.8 : 1.7) * pap;
    let w = t.D / 2 + 1.4;
    const endF = Math.min(1, (largo - Math.abs(L)) / 3.5);
    const e = endF * endF * (3 - 2 * endF);
    w *= 0.35 + 0.65 * e;
    tope = yFondo + (tope - yFondo) * (0.55 + 0.45 * e);
    const cy = (tope + yFondo) / 2;
    const h = (tope - yFondo) / 2;
    for (let j = 0; j < SECCION; j += 1) {
      const ph = (j / SECCION) * Math.PI * 2;
      const c = Math.cos(ph);
      const s = Math.sin(ph);
      const n = w * Math.sign(c) * Math.abs(c) ** 0.42;
      const y = cy + h * Math.sign(s) * Math.abs(s) ** 0.3;
      pos.push((fr.px + fr.nx * n) * MM, y * MM, (fr.pz + fr.nz * n) * MM);
      const rel = tope - y;
      if (rel < 2.2) tmp.copy(C_ALTO).lerp(C_MEDIO, rel / 2.2);
      else tmp.copy(C_MEDIO).lerp(C_BAJO, Math.min(1, (rel - 2.2) / 7));
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let k = 0; k < S; k += 1) {
    for (let j = 0; j < SECCION; j += 1) {
      const j2 = (j + 1) % SECCION;
      const a = k * SECCION + j;
      const b = k * SECCION + j2;
      const c = (k + 1) * SECCION + j2;
      const d = (k + 1) * SECCION + j;
      idx.push(a, b, c, a, c, d);
    }
  }
  // Tapas de los extremos.
  const tapa = (L: number): number => {
    const fr = marcoEn(arco, L);
    const t = cercana(L);
    pos.push(fr.px * MM, ((yFondo + t.cej) / 2) * MM, fr.pz * MM);
    col.push(C_BAJO.r, C_BAJO.g, C_BAJO.b);
    return pos.length / 3 - 1;
  };
  const capA = tapa(-largo);
  const capB = tapa(largo);
  for (let j = 0; j < SECCION; j += 1) {
    const j2 = (j + 1) % SECCION;
    idx.push(capA, j2, j, capB, S * SECCION + j, S * SECCION + j2);
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();

  // Normales hacia afuera: se comprueba en el punto más alto de la sección central.
  const normal = g.getAttribute("normal");
  const medio = Math.floor(S / 2) * SECCION;
  let mejor = medio;
  let yMax = -Infinity;
  for (let j = 0; j < SECCION; j += 1) {
    const y = pos[(medio + j) * 3 + 1]!;
    if (y > yMax) {
      yMax = y;
      mejor = medio + j;
    }
  }
  if (normal.getY(mejor) < 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const tmpIdx = idx[i + 1]!;
      idx[i + 1] = idx[i + 2]!;
      idx[i + 2] = tmpIdx;
    }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

export function Encia3D({ superior, temporal }: { superior: boolean; temporal: boolean }) {
  const geometria = useMemo(() => geometriaEncia(disposicionArcada(superior, temporal)), [superior, temporal]);

  useEffect(() => () => geometria.dispose(), [geometria]);

  return (
    <group
      position={[0, superior ? JUEGO_MANDIBULAR : -JUEGO_MANDIBULAR, 0]}
      scale={[1, superior ? -1 : 1, 1]}
      userData={{ encia: true }}
    >
      <mesh geometry={geometria} material={materialEncia()} userData={{ encia: true }} raycast={() => null} />
    </group>
  );
}
