export interface LineaCalculo {
  cantidad: number;
  precioUnitario: number;
}

export interface TotalesPresupuesto {
  /** Total de cada línea, en la misma posición que la entrada. */
  totalesLinea: number[];
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
}

const aCentavos = (v: number) => Math.round(v * 100);
const deCentavos = (c: number) => c / 100;

/**
 * Calcula los totales de un presupuesto en centavos enteros (sin deriva de coma
 * flotante). El descuento se aplica sobre el subtotal y el IVA sobre lo descontado.
 * Es la misma fórmula en el servidor y en el formulario.
 */
export function calcularTotalesPresupuesto(
  lineas: LineaCalculo[],
  descuentoPorcentaje: number,
  ivaPorcentaje: number,
): TotalesPresupuesto {
  const centavosLinea = lineas.map((l) => aCentavos(l.precioUnitario) * l.cantidad);
  const subtotal = centavosLinea.reduce((a, b) => a + b, 0);
  const descuento = Math.round((subtotal * descuentoPorcentaje) / 100);
  const base = subtotal - descuento;
  const iva = Math.round((base * ivaPorcentaje) / 100);
  return {
    totalesLinea: centavosLinea.map(deCentavos),
    subtotal: deCentavos(subtotal),
    descuento: deCentavos(descuento),
    iva: deCentavos(iva),
    total: deCentavos(base + iva),
  };
}

/** Clave estable de un tratamiento: minúsculas, sin tildes, espacios → guion. */
export function claveTratamiento(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
