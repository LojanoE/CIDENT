import { CPO_CATEGORIAS } from "./odontograma.js";
import type { Odontograma, ResultadoCPO, Condicion } from "./types.js";

type CategoriaCPO = "C" | "P" | "O";

/** Prioridad clínica cuando una pieza tiene condiciones de varias categorías. */
const PRIORIDAD: readonly CategoriaCPO[] = ["P", "O", "C"];

function categoriaDeCondicion(condicion: Condicion): CategoriaCPO | null {
  if (CPO_CATEGORIAS.C.includes(condicion)) return "C";
  if (CPO_CATEGORIAS.P.includes(condicion)) return "P";
  if (CPO_CATEGORIAS.O.includes(condicion)) return "O";
  return null;
}

/** Todas las condiciones registradas sobre una pieza: la general + las de cada zona. */
function condicionesDeLaPieza(odo: Odontograma, fdi: string): Condicion[] {
  const diente = odo[fdi];
  if (!diente) return [];
  const condiciones: Condicion[] = [];
  if (diente.general) condiciones.push(...diente.general.estados);
  for (const zona of Object.values(diente.zonas)) {
    if (zona) condiciones.push(...zona.estados);
  }
  return condiciones;
}

/**
 * Calcula el índice CPO (Cariados / Perdidos / Obturados) corregido al
 * estándar epidemiológico de la OMS: **cada pieza cuenta una sola vez**, en
 * la categoría de mayor prioridad clínica cuando tiene condiciones mixtas
 * (P > O > C — una pieza indicada para extracción o ya perdida pesa más que
 * una simplemente obturada, y una obturada pesa más que una con caries
 * activa sin tratar aún).
 *
 * Esto corrige el comportamiento de `app.py:553-603`, que usaba tres
 * conjuntos (`c_teeth`, `p_teeth`, `o_teeth`) independientes y sumaba sus
 * tamaños: una pieza con "Caries" y "Obturación" a la vez se contaba en
 * ambos conjuntos, de modo que `total` podía superar el número real de
 * piezas (32 en adultos, 20 en infantil). Aquí `total` nunca puede superar
 * `Object.keys(odo).length`.
 */
export function calcularCPO(odo: Odontograma): ResultadoCPO {
  let c = 0;
  let p = 0;
  let o = 0;

  for (const fdi of Object.keys(odo)) {
    const categorias = new Set<CategoriaCPO>();
    for (const condicion of condicionesDeLaPieza(odo, fdi)) {
      const categoria = categoriaDeCondicion(condicion);
      if (categoria) categorias.add(categoria);
    }
    if (categorias.size === 0) continue;

    const categoriaGanadora = PRIORIDAD.find((cat) => categorias.has(cat));
    if (categoriaGanadora === "C") c += 1;
    else if (categoriaGanadora === "P") p += 1;
    else if (categoriaGanadora === "O") o += 1;
  }

  return { c, p, o, total: c + p + o };
}
