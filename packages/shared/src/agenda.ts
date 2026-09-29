import { type EstadoCita } from "./types.js";

/**
 * Lógica pura de la agenda compartida del centro.
 *
 * Las citas se guardan en **hora de pared local** ('YYYY-MM-DDTHH:MM', sin
 * zona ni offset), no como instantes UTC. Una agenda odontológica es horaria
 * en el sentido del reloj de la pared: «el martes a las tres» no cambia de
 * significado si cambia el offset. Guardarla así tiene tres consecuencias que
 * este módulo aprovecha:
 *
 * - El orden lexicográfico coincide exactamente con el cronológico, así que
 *   detectar un solapamiento es comparar strings.
 * - El día de una cita es el prefijo de su marca, así que no hace falta un
 *   campo `fecha` aparte que pueda desincronizarse. Con instantes UTC sí haría
 *   falta, y se contradirían: un turno de 20:00 en Ecuador (UTC-5) cae en el
 *   día UTC siguiente, así que el par fecha+instante discrepa en cuanto se
 *   cruza la medianoche.
 * - Una sola consulta de rango sobre `inicio` sirve para un día y para una
 *   semana, con un único índice compuesto.
 *
 * Los `createdAt`/`updatedAt` de la cita sí son instantes ISO con `Z`, igual
 * que en el resto del modelo: son sellos de auditoría, no horarios clínicos.
 * El mismo reparto que ya hace `Atencion` entre `fecha` y `createdAt`.
 *
 * La aritmética usa `Date.UTC` sobre los componentes de calendario, que acá no
 * significa «en UTC» sino «sin zona»: evita que un cambio de horario de verano
 * corra una franja media hora en husos que lo aplican.
 */

const MARCA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Marca de tiempo local 'YYYY-MM-DDTHH:MM'. */
export type MarcaLocal = string;

/** Día local 'YYYY-MM-DD'. */
export type DiaLocal = string;

export interface Franja {
  inicio: MarcaLocal;
  fin: MarcaLocal;
}

export interface HorarioAtencion {
  /** Días laborables, con la convención de `Date#getDay`: 0 domingo … 6 sábado. */
  diasHabiles: number[];
  horaApertura: string;
  horaCierre: string;
  /** Paso de la rejilla, en minutos. */
  franjaMin: number;
}

/**
 * Horario del centro. Vive acá como constante y no como campo de `Centro`
 * porque todavía no se pidió configurable; moverlo al documento del centro
 * después no rompe nada, porque todas las funciones lo reciben por parámetro.
 */
export const HORARIO_POR_DEFECTO: HorarioAtencion = {
  diasHabiles: [1, 2, 3, 4, 5, 6],
  horaApertura: "08:00",
  horaCierre: "20:00",
  franjaMin: 30,
};

/** Duraciones ofrecidas en el formulario de cita. */
export const DURACIONES_MIN = [15, 20, 30, 45, 60, 90] as const;

/**
 * Datos mínimos para razonar sobre ocupación. Deliberadamente más chico que
 * `Cita`: el formulario necesita evaluar un candidato que todavía no es un
 * documento.
 */
export interface Ocupacion {
  appointmentId?: string;
  profesionalUid: string;
  inicio: MarcaLocal;
  fin: MarcaLocal;
  estado?: EstadoCita;
}

function componentes(marca: MarcaLocal): [number, number, number, number, number] {
  const m = MARCA.exec(marca);
  if (!m) throw new RangeError(`Marca de tiempo local inválida: ${marca}`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
}

function formatear(fecha: Date): MarcaLocal {
  const p = (n: number, largo = 2) => String(n).padStart(largo, "0");
  return (
    `${p(fecha.getUTCFullYear(), 4)}-${p(fecha.getUTCMonth() + 1)}-${p(fecha.getUTCDate())}` +
    `T${p(fecha.getUTCHours())}:${p(fecha.getUTCMinutes())}`
  );
}

/** Día de una marca: 'YYYY-MM-DDTHH:MM' → 'YYYY-MM-DD'. */
export function diaDe(marca: MarcaLocal): DiaLocal {
  return marca.slice(0, 10);
}

/** Hora de una marca, para mostrar: 'YYYY-MM-DDTHH:MM' → 'HH:MM'. */
export function horaDe(marca: MarcaLocal): string {
  return marca.slice(11, 16);
}

/**
 * Suma minutos a una marca local, cruzando correctamente medianoche, mes y
 * año. Lanza `RangeError` con una marca malformada: siempre se la llama con
 * valores que el propio código construyó, así que un formato inválido es un
 * error de programación y no un dato del usuario (eso lo filtra `citaSchema`).
 */
export function sumarMinutos(marca: MarcaLocal, minutos: number): MarcaLocal {
  const [anio, mes, dia, hora, min] = componentes(marca);
  return formatear(new Date(Date.UTC(anio, mes - 1, dia, hora, min + minutos)));
}

/** Suma días a un día local 'YYYY-MM-DD'. */
export function sumarDias(dia: DiaLocal, dias: number): DiaLocal {
  const m = DIA.exec(dia);
  if (!m) throw new RangeError(`Día local inválido: ${dia}`);
  const fecha = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dias));
  return formatear(fecha).slice(0, 10);
}

/** Minutos entre el inicio y el fin de una franja. */
export function duracionMinutos(franja: Franja): number {
  const [a1, a2, a3, a4, a5] = componentes(franja.inicio);
  const [b1, b2, b3, b4, b5] = componentes(franja.fin);
  const desde = Date.UTC(a1, a2 - 1, a3, a4, a5);
  const hasta = Date.UTC(b1, b2 - 1, b3, b4, b5);
  return Math.round((hasta - desde) / 60_000);
}

/**
 * Día de la semana de un día local, con la convención de `Date#getDay`
 * (0 domingo … 6 sábado).
 */
export function diaDeLaSemana(dia: DiaLocal): number {
  const m = DIA.exec(dia);
  if (!m) throw new RangeError(`Día local inválido: ${dia}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

export function esDiaHabil(dia: DiaLocal, horario: HorarioAtencion = HORARIO_POR_DEFECTO): boolean {
  if (!DIA.test(dia)) return false;
  return horario.diasHabiles.includes(diaDeLaSemana(dia));
}

/** Lunes de la semana que contiene al día dado. */
export function inicioDeSemana(dia: DiaLocal): DiaLocal {
  const numero = diaDeLaSemana(dia);
  // getDay() pone el domingo en 0; la semana clínica arranca el lunes.
  const desplazamiento = numero === 0 ? -6 : 1 - numero;
  return sumarDias(dia, desplazamiento);
}

/**
 * Rango semiabierto `[desde, hasta)` de un día, para la consulta de Firestore:
 * `where('inicio', '>=', desde)` y `where('inicio', '<', hasta)`. Semiabierto
 * y no `<= 'T23:59'` para que no quede un borde raro en el último minuto.
 */
export function rangoDelDia(dia: DiaLocal): Franja {
  return { inicio: `${dia}T00:00`, fin: `${sumarDias(dia, 1)}T00:00` };
}

/** Rango semiabierto de la semana (lunes a domingo) que contiene al día dado. */
export function rangoDeLaSemana(dia: DiaLocal): Franja {
  const lunes = inicioDeSemana(dia);
  return { inicio: `${lunes}T00:00`, fin: `${sumarDias(lunes, 7)}T00:00` };
}

/** Los siete días de la semana que contiene al día dado, de lunes a domingo. */
export function diasDeLaSemana(dia: DiaLocal): DiaLocal[] {
  const lunes = inicioDeSemana(dia);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

/**
 * Marcas de inicio de cada franja de la rejilla de un día. Devuelve `[]` si el
 * día no es laborable o si el horario es incoherente, en vez de lanzar: la
 * rejilla se calcula en cada render y una excepción rompería la pantalla.
 */
export function franjasDelDia(
  dia: DiaLocal,
  horario: HorarioAtencion = HORARIO_POR_DEFECTO,
): MarcaLocal[] {
  if (!esDiaHabil(dia, horario)) return [];
  if (!Number.isFinite(horario.franjaMin) || horario.franjaMin < 1) return [];

  const apertura = `${dia}T${horario.horaApertura}`;
  const cierre = `${dia}T${horario.horaCierre}`;
  if (!MARCA.test(apertura) || !MARCA.test(cierre) || cierre <= apertura) return [];

  const marcas: MarcaLocal[] = [];
  let actual = apertura;
  // `< cierre`: una franja que arranca justo a la hora de cierre no existe.
  while (actual < cierre) {
    marcas.push(actual);
    actual = sumarMinutos(actual, horario.franjaMin);
  }
  return marcas;
}

/**
 * Una cita cancelada o marcada como ausente libera su franja: el horario
 * vuelve a estar disponible y no debe contar como conflicto.
 */
export function ocupaFranja(estado: EstadoCita | undefined): boolean {
  return estado !== "cancelada" && estado !== "ausente";
}

/**
 * Dos franjas se solapan. Intervalos semiabiertos `[inicio, fin)`: una cita
 * que termina 15:30 y otra que empieza 15:30 no se solapan, que es lo que
 * espera cualquiera que agende turnos consecutivos.
 */
export function solapan(a: Franja, b: Franja): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

/**
 * Citas del mismo profesional que choquen con la candidata. Devuelve los
 * objetos recibidos (genérico) para que la interfaz pueda mostrar el nombre y
 * la hora de lo que está chocando, no solo avisar de que hay un choque.
 *
 * Por decisión de producto el solapamiento **advierte pero no bloquea**: quien
 * agenda decide. Solo mira el profesional, no el paciente.
 */
export function citasEnConflicto<T extends Ocupacion>(candidata: Ocupacion, existentes: T[]): T[] {
  if (!ocupaFranja(candidata.estado)) return [];
  return existentes.filter(
    (cita) =>
      cita.profesionalUid === candidata.profesionalUid &&
      // Editar una cita no puede chocar consigo misma.
      (candidata.appointmentId === undefined || cita.appointmentId !== candidata.appointmentId) &&
      ocupaFranja(cita.estado) &&
      solapan(cita, candidata),
  );
}
