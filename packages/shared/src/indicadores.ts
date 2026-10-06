import type { EstadoCita, EstadoPresupuesto } from "./types.js";

/** Filas mínimas que necesita el cálculo: el cliente las lee de Firestore ya acotadas al mes. */
export interface DatosIndicadores {
  citas: { estado: EstadoCita }[];
  pacientesNuevos: number;
  /** Atenciones finalizadas, con el uid de quien las cerró. */
  atenciones: { finalizedBy?: string }[];
  /** Ítems del plan realizados en el mes, con el uid del profesional. */
  tratamientos: { tratamiento: string; uid: string }[];
  presupuestos: { estado: EstadoPresupuesto }[];
}

export interface ConteoProfesional {
  uid: string;
  total: number;
}

export interface Indicadores {
  /** Porcentaje 0-100 de ausentes sobre (atendidas + ausentes); `null` si no hubo citas cerradas. */
  inasistencia: number | null;
  citasCerradas: number;
  pacientesNuevos: number;
  atenciones: number;
  atencionesPorProfesional: ConteoProfesional[];
  tratamientos: number;
  tratamientosPorProfesional: ConteoProfesional[];
  topTratamientos: { tratamiento: string; total: number }[];
  /** Porcentaje 0-100 de aceptados sobre (aceptados + rechazados); `null` si ninguno se resolvió. */
  aceptacion: number | null;
  presupuestosResueltos: number;
}

function porcentaje(parte: number, total: number): number | null {
  return total === 0 ? null : Math.round((parte / total) * 1000) / 10;
}

function agrupar(claves: string[]): { clave: string; total: number }[] {
  const mapa = new Map<string, number>();
  for (const c of claves) mapa.set(c, (mapa.get(c) ?? 0) + 1);
  return [...mapa.entries()]
    .map(([clave, total]) => ({ clave, total }))
    .sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave));
}

export function calcularIndicadores(d: DatosIndicadores): Indicadores {
  const ausentes = d.citas.filter((c) => c.estado === "ausente").length;
  const atendidas = d.citas.filter((c) => c.estado === "atendida").length;
  const aceptados = d.presupuestos.filter((p) => p.estado === "aceptado").length;
  const rechazados = d.presupuestos.filter((p) => p.estado === "rechazado").length;

  return {
    inasistencia: porcentaje(ausentes, ausentes + atendidas),
    citasCerradas: ausentes + atendidas,
    pacientesNuevos: d.pacientesNuevos,
    atenciones: d.atenciones.length,
    atencionesPorProfesional: agrupar(d.atenciones.map((a) => a.finalizedBy ?? "")).map(({ clave, total }) => ({
      uid: clave,
      total,
    })),
    tratamientos: d.tratamientos.length,
    tratamientosPorProfesional: agrupar(d.tratamientos.map((t) => t.uid)).map(({ clave, total }) => ({
      uid: clave,
      total,
    })),
    topTratamientos: agrupar(d.tratamientos.map((t) => t.tratamiento.trim().toLowerCase()))
      .slice(0, 5)
      .map(({ clave, total }) => ({ tratamiento: clave, total })),
    aceptacion: porcentaje(aceptados, aceptados + rechazados),
    presupuestosResueltos: aceptados + rechazados,
  };
}

/** Mes anterior de un `YYYY-MM`. */
export function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

/** Mes siguiente de un `YYYY-MM`. */
export function mesSiguiente(mes: string): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

/** Diferencia con el mes previo: `null` si alguno de los dos no existe. */
export function variacion(actual: number | null, previo: number | null): number | null {
  if (actual === null || previo === null) return null;
  return Math.round((actual - previo) * 10) / 10;
}
