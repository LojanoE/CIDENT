export interface Edad {
  anios: number;
  meses: number;
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Calcula la edad (años y meses cumplidos) a partir de una fecha de
 * nacimiento en formato ISO ('YYYY-MM-DD'), tomando como referencia la fecha
 * local de hoy. Traducción directa de `calcular_edad` (`utils.py:70-98`).
 *
 * Trabaja siempre con componentes numéricos (año/mes/día) en vez de con
 * objetos `Date`: comparar instantes UTC contra una fecha "solo día" es una
 * fuente clásica de errores de un día cerca de la medianoche en husos
 * horarios negativos (p. ej. Ecuador, UTC-5). "Hoy" se toma en la hora local
 * del navegador/servidor, que es lo relevante para una edad clínica.
 *
 * La edad NO se persiste en `patients/{pid}`: se deriva siempre a partir de
 * `fechaNacimiento`, tanto en la UI como en los PDFs.
 */
export function calcularEdad(fechaNacimientoISO: string | null | undefined): Edad | null {
  if (!fechaNacimientoISO || !FECHA_ISO.test(fechaNacimientoISO)) return null;

  const [anioNac, mesNac, diaNac] = fechaNacimientoISO.split("-").map(Number) as [
    number,
    number,
    number,
  ];

  // Valida que la fecha exista de verdad (rechaza p. ej. "2024-02-30").
  const comprobacion = new Date(Date.UTC(anioNac, mesNac - 1, diaNac));
  if (
    Number.isNaN(comprobacion.getTime()) ||
    comprobacion.getUTCFullYear() !== anioNac ||
    comprobacion.getUTCMonth() !== mesNac - 1 ||
    comprobacion.getUTCDate() !== diaNac
  ) {
    return null;
  }

  const hoy = new Date();
  const anioHoy = hoy.getFullYear();
  const mesHoy = hoy.getMonth() + 1;
  const diaHoy = hoy.getDate();

  let anios = anioHoy - anioNac;
  if (mesHoy < mesNac || (mesHoy === mesNac && diaHoy < diaNac)) {
    anios -= 1;
  }

  let meses = mesHoy - mesNac;
  if (diaHoy < diaNac) {
    meses -= 1;
  }
  if (meses < 0) {
    meses += 12;
  }

  return { anios, meses };
}
