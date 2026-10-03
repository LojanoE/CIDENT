import type { TipoPieza } from "@cident/shared";
import { BoxGeometry, CylinderGeometry } from "three";
import type { BufferAttribute } from "three";

/** Medidas (cm) de la corona por tipo de pieza; el ancho mesio-distal sale de `posicionPieza`. */
export const DIMENSIONES: Record<TipoPieza, { alto: number; profundidad: number; raiz: number }> = {
  incisivo: { alto: 1.0, profundidad: 0.7, raiz: 1.2 },
  canino: { alto: 1.1, profundidad: 0.85, raiz: 1.5 },
  premolar: { alto: 0.8, profundidad: 0.9, raiz: 1.1 },
  molar: { alto: 0.75, profundidad: 1.05, raiz: 0.95 },
};

/**
 * Orden de los 6 grupos de `BoxGeometry` (un material por cara):
 * +x, -x, +y, -y, +z, -z. `Diente3D` asocia cada uno a una zona clínica.
 */
export const EJES_GRUPOS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const coronas = new Map<TipoPieza, BoxGeometry>();
let raiz: CylinderGeometry | null = null;

function suavizar(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Corona unitaria (caja de lado 1 centrada en el origen) redondeada y con relieve oclusal
 * propio de cada tipo. Se cachea: las 32 piezas comparten 4 geometrías y se escalan con `scale`.
 */
export function geometriaCorona(tipo: TipoPieza): BoxGeometry {
  const cacheada = coronas.get(tipo);
  if (cacheada) return cacheada;

  const g = new BoxGeometry(1, 1, 1, 6, 6, 6);
  const pos = g.getAttribute("position") as BufferAttribute;

  for (let i = 0; i < pos.count; i += 1) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Redondeo: mezcla de la caja con la esfera inscrita (las esquinas se repliegan).
    const largo = Math.hypot(x, y, z) || 1;
    const t = 0.45;
    x = x * (1 - t) + (x / largo) * 0.5 * t;
    y = y * (1 - t) + (y / largo) * 0.5 * t;
    z = z * (1 - t) + (z / largo) * 0.5 * t;

    // Cuello más estrecho que la cara oclusal.
    const cuello = 0.78 + 0.22 * (y + 0.5);
    x *= cuello;
    z *= cuello;

    // Relieve oclusal, solo en el cuarto superior de la corona.
    const cima = suavizar((y - 0.2) / 0.3);
    switch (tipo) {
      case "molar":
        y += 0.09 * cima * (-Math.cos(4 * Math.PI * x) - Math.cos(4 * Math.PI * z)) * 0.5;
        break;
      case "premolar":
        y += 0.1 * cima * -Math.cos(4 * Math.PI * z);
        break;
      case "canino": {
        const punta = Math.max(0, 1 - Math.hypot(x / 0.4, z / 0.45));
        y += 0.32 * cima * punta;
        x *= 1 - 0.35 * cima;
        z *= 1 - 0.25 * cima;
        break;
      }
      case "incisivo":
        z *= 1 - 0.4 * cima; // borde incisal en filo
        break;
    }

    pos.setXYZ(i, x, y, z);
  }

  g.computeVertexNormals();
  coronas.set(tipo, g);
  return g;
}

/** Raíz unitaria (cono truncado de alto 1, radio superior 0.5); apunta hacia -y al escalarla. */
export function geometriaRaiz(): CylinderGeometry {
  raiz ??= new CylinderGeometry(0.5, 0.12, 1, 12, 1);
  return raiz;
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
