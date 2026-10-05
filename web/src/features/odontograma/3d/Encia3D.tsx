import { longitudHemiarco, margenGingival, posicionPieza, puntoEnArco } from "@cident/shared";
import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { materialEncia } from "./materiales";

/**
 * Encía de una arcada: una cinta en "U" barrida a lo largo de la curva de los dientes, con el
 * borde festoneado (sube en las papilas, baja en el centro de cada pieza), más el paladar
 * (arcada superior) o un piso lingual (inferior). Se dibuja en el mismo marco que los dientes:
 * "profundidad" es la distancia desde el plano oclusal hacia la raíz.
 */

const PASO = 0.06;
const MARGEN_CERVICAL = 0.85;
const ELEVACION_PAPILA = 0.15;
const FONDO = 1.1;
/** Perfil de la sección (u = hacia vestibular, d = profundidad respecto del margen). */
const PERFIL: ReadonlyArray<readonly [number, number]> = [
  [-0.3, 0],
  [-0.8, 0.1],
  [-0.85, 0.8],
  [-0.7, 99], // 99 = al fondo (se reemplaza por FONDO)
  [0.7, 99],
  [0.85, 0.8],
  [0.8, 0.1],
  [0.3, 0],
];

const ROSA_MARGEN = [0.95, 0.64, 0.62] as const;
const ROSA_BASE = [0.76, 0.36, 0.4] as const;

function mezcla(t: number): [number, number, number] {
  return [
    ROSA_MARGEN[0] + (ROSA_BASE[0] - ROSA_MARGEN[0]) * t,
    ROSA_MARGEN[1] + (ROSA_BASE[1] - ROSA_MARGEN[1]) * t,
    ROSA_MARGEN[2] + (ROSA_BASE[2] - ROSA_MARGEN[2]) * t,
  ];
}

interface Estacion {
  x: number;
  z: number;
  /** Normal horizontal hacia vestibular. */
  nx: number;
  nz: number;
  margen: number;
}

function estaciones(temporal: boolean): Estacion[] {
  const largo = longitudHemiarco(temporal);
  const n = Math.ceil((2 * largo) / PASO);
  const salida: Estacion[] = [];
  for (let i = 0; i <= n; i += 1) {
    const s = -largo + (2 * largo * i) / n;
    const { x: xAbs, z } = puntoEnArco(Math.abs(s));
    const x = s < 0 ? -xAbs : xAbs;
    salida.push({ x, z, nx: 0, nz: 1, margen: MARGEN_CERVICAL - ELEVACION_PAPILA * margenGingival(Math.abs(s), temporal) });
  }
  // Normales por diferencias finitas de la curva.
  for (let i = 0; i < salida.length; i += 1) {
    const a = salida[Math.max(0, i - 1)]!;
    const b = salida[Math.min(salida.length - 1, i + 1)]!;
    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const largoT = Math.hypot(tx, tz) || 1;
    const e = salida[i]!;
    // Tangente (tx, tz) girada hacia afuera de la arcada (+z en la línea media).
    e.nx = -tz / largoT;
    e.nz = tx / largoT;
    if (e.nz < 0) {
      e.nx = -e.nx;
      e.nz = -e.nz;
    }
  }
  return salida;
}

function geometriaCinta(est: Estacion[]): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const P = PERFIL.length;

  for (const e of est) {
    PERFIL.forEach(([u, d]) => {
      const profundidad = d === 99 ? FONDO : e.margen + d;
      pos.push(e.x + e.nx * u, -profundidad, e.z + e.nz * u);
      // Más claro cerca del margen, más oscuro hacia el fondo.
      const t = Math.min(1, Math.max(0, (profundidad - e.margen) / (FONDO - e.margen)));
      const c = mezcla(t * t);
      col.push(c[0], c[1], c[2]);
    });
  }

  for (let i = 0; i < est.length - 1; i += 1) {
    for (let k = 0; k < P; k += 1) {
      const a = i * P + k;
      const b = i * P + ((k + 1) % P);
      const c = (i + 1) * P + k;
      const d = (i + 1) * P + ((k + 1) % P);
      idx.push(a, b, c, b, d, c);
    }
  }

  // Tapas de los extremos (abanico desde el primer punto del perfil).
  for (const base of [0, (est.length - 1) * P]) {
    for (let k = 1; k < P - 1; k += 1) idx.push(base, base + k, base + k + 1);
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Bóveda del paladar (superior) o piso lingual (inferior): abanico desde el borde lingual hacia el centro. */
function geometriaBoveda(est: Estacion[], superior: boolean): BufferGeometry {
  const FILAS = 8;
  const centroZ = superior ? -0.4 : 1.0;
  const hondura = superior ? 0.9 : 0.5;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];

  for (const e of est) {
    const ex = e.x - e.nx * 0.3;
    const ez = e.z - e.nz * 0.3;
    for (let r = 0; r <= FILAS; r += 1) {
      const t = (0.6 * r) / FILAS;
      const suave = t * t * (3 - 2 * t);
      pos.push(ex * (1 - t), -(e.margen + hondura * suave), ez + (centroZ - ez) * t);
      const c = mezcla(0.15 + 0.45 * t);
      col.push(c[0], c[1], c[2]);
    }
  }
  const R = FILAS + 1;
  for (let i = 0; i < est.length - 1; i += 1) {
    for (let r = 0; r < FILAS; r += 1) {
      const a = i * R + r;
      const b = (i + 1) * R + r;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function Encia3D({ superior, temporal }: { superior: boolean; temporal: boolean }) {
  const geometrias = useMemo(() => {
    const est = estaciones(temporal);
    return [geometriaCinta(est), geometriaBoveda(est, superior)];
  }, [superior, temporal]);

  useEffect(
    () => () => {
      for (const g of geometrias) g.dispose();
    },
    [geometrias],
  );

  const material = materialEncia();
  const y = posicionPieza(superior ? (temporal ? 51 : 11) : temporal ? 71 : 31).y;

  return (
    <group position={[0, y, 0]} scale={[1, superior ? -1 : 1, 1]} userData={{ encia: true }}>
      {geometrias.map((g, i) => (
        <mesh
          key={i}
          geometry={g}
          material={material}
          userData={{ encia: true }}
          raycast={() => null}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
