import type { Condicion, ItemPlan, Odontograma, Zona } from "./types.js";

/** Odontograma de una atención, con lo mínimo para armar la línea de tiempo. */
export interface FotoOdontograma {
  visitId: string;
  fecha: string; // 'YYYY-MM-DD'
  dientes: Odontograma;
}

export interface EntradaHistorialDiente {
  visitId: string;
  fecha: string;
  /** Descripción del cambio respecto de la atención anterior, p. ej. "Caries → Obturación". */
  cambio: string | null;
  tratamientos: string[];
}

/** Estado de una pieza como texto estable: "general: X | oclusal: Y, Z". Vacío si no hay nada. */
function resumenPieza(dientes: Odontograma, fdi: number): string {
  const d = dientes[String(fdi)];
  if (!d) return "";
  const partes: string[] = [];
  const estados = (e?: readonly Condicion[]) => (e ?? []).join(", ");
  if (d.general && d.general.estados.length > 0) partes.push(estados(d.general.estados));
  for (const [zona, ez] of Object.entries(d.zonas) as [Zona, (typeof d.zonas)[Zona]][]) {
    if (ez && ez.estados.length > 0) partes.push(`${zona}: ${estados(ez.estados)}`);
  }
  return partes.join(" | ");
}

/**
 * Línea de tiempo de una pieza: una entrada por atención donde la pieza cambió respecto de la
 * anterior o donde se realizó un tratamiento sobre ella. Las fotos se ordenan por fecha.
 */
export function historialDiente(
  fdi: number,
  fotos: readonly FotoOdontograma[],
  plan: readonly ItemPlan[],
): EntradaHistorialDiente[] {
  const ordenadas = [...fotos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const salida: EntradaHistorialDiente[] = [];
  let anterior = "";
  for (const foto of ordenadas) {
    const actual = resumenPieza(foto.dientes, fdi);
    const tratamientos = plan
      .filter((i) => i.estado === "realizado" && i.pieza === String(fdi) && i.realizado?.visitId === foto.visitId)
      .map((i) => i.tratamiento);
    const cambio = actual !== anterior ? `${anterior || "Sin registro"} → ${actual || "Sin registro"}` : null;
    if (cambio || tratamientos.length > 0) {
      salida.push({ visitId: foto.visitId, fecha: foto.fecha, cambio, tratamientos });
    }
    anterior = actual;
  }
  return salida;
}
