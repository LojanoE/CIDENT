import {
  HORARIO_POR_DEFECTO,
  esDiaHabil,
  horaDe,
  ocupaFranja,
  type Cita,
  type HorarioAtencion,
  type Usuario,
} from "@cident/shared";
import { useMemo } from "react";
import { EmptyState } from "../../components/ui";
import { cn } from "../../lib/cn";
import { ETIQUETA_ESTADO } from "./estados";
import { TarjetaCita } from "./TarjetaCita";

const PX_POR_MIN = 1.2;
const ALTO_MIN_CITA = 22;

function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface Posicionada {
  cita: Cita;
  carril: number;
  carriles: number;
}

/**
 * Reparte en carriles las citas de una columna que se pisan entre sí (el
 * solapamiento se advierte pero se permite), para que ninguna quede tapada.
 */
function repartirEnCarriles(citas: Cita[]): Posicionada[] {
  const ordenadas = [...citas].sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
  const resultado: Posicionada[] = [];
  let grupo: Posicionada[] = [];
  let finGrupo = "";
  let finPorCarril: string[] = [];

  const cerrarGrupo = () => {
    for (const p of grupo) p.carriles = finPorCarril.length;
    resultado.push(...grupo);
    grupo = [];
    finPorCarril = [];
    finGrupo = "";
  };

  for (const cita of ordenadas) {
    if (grupo.length > 0 && cita.inicio >= finGrupo) cerrarGrupo();
    let carril = finPorCarril.findIndex((fin) => fin <= cita.inicio);
    if (carril === -1) carril = finPorCarril.length;
    finPorCarril[carril] = cita.fin;
    if (cita.fin > finGrupo) finGrupo = cita.fin;
    grupo.push({ cita, carril, carriles: 1 });
  }
  cerrarGrupo();
  return resultado;
}

interface VistaDiaProps {
  dia: string;
  citas: Cita[];
  profesionales: Usuario[];
  horario?: HorarioAtencion;
  onNueva: (hora: string, profesionalUid: string) => void;
  onAbrir: (cita: Cita) => void;
}

/** Cuadrícula de escritorio: una columna por profesional, eje horario a la izquierda. */
export function VistaDia({ dia, citas, profesionales, horario = HORARIO_POR_DEFECTO, onNueva, onAbrir }: VistaDiaProps) {
  const { desde, hasta } = useMemo(() => {
    let desde = aMinutos(horario.horaApertura);
    let hasta = aMinutos(horario.horaCierre);
    // Una cita fuera de horario tiene que verse igual.
    for (const c of citas) {
      desde = Math.min(desde, aMinutos(horaDe(c.inicio)));
      const fin = c.fin.slice(0, 10) === dia ? aMinutos(horaDe(c.fin)) : 24 * 60;
      hasta = Math.max(hasta, fin);
    }
    desde = Math.floor(desde / 60) * 60;
    hasta = Math.min(24 * 60, Math.ceil(hasta / 60) * 60);
    return { desde, hasta };
  }, [citas, dia, horario.horaApertura, horario.horaCierre]);

  const franjaMin = horario.franjaMin;
  const franjas = useMemo(() => {
    const lista: number[] = [];
    for (let m = desde; m < hasta; m += franjaMin) lista.push(m);
    return lista;
  }, [desde, hasta, franjaMin]);

  const porProfesional = useMemo(() => {
    const mapa = new Map<string, Posicionada[]>();
    for (const p of profesionales) {
      mapa.set(
        p.uid,
        repartirEnCarriles(citas.filter((c) => c.profesionalUid === p.uid && ocupaFranja(c.estado))),
      );
    }
    return mapa;
  }, [citas, profesionales]);

  const liberadas = citas.filter((c) => !ocupaFranja(c.estado));
  const habil = esDiaHabil(dia, horario);
  const alto = (hasta - desde) * PX_POR_MIN;

  return (
    <div className="space-y-4">
      {!habil && (
        <p className="rounded-md border border-line bg-surface px-3 py-2 text-13 text-ink-soft">
          Este día no es laborable en el horario del centro. Aun así puedes agendar una cita.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
        <div
          className="grid min-w-max"
          style={{ gridTemplateColumns: `4rem repeat(${profesionales.length}, minmax(13rem, 1fr))` }}
        >
          <div className="sticky left-0 z-10 border-b border-line bg-surface" />
          {profesionales.map((p) => (
            <div key={p.uid} className="border-b border-l border-line px-3 py-2 text-sm font-medium">
              {p.nombreCompleto}
            </div>
          ))}

          {/* Eje horario */}
          <div className="sticky left-0 z-10 bg-surface" style={{ height: alto }}>
            {franjas.map((m) => (
              <div
                key={m}
                className="border-t border-line pr-2 text-right font-mono text-xs text-ink-soft first:border-t-0"
                style={{ height: franjaMin * PX_POR_MIN }}
              >
                {m % 60 === 0 ? aHora(m) : ""}
              </div>
            ))}
          </div>

          {profesionales.map((p) => (
            <div key={p.uid} className="relative border-l border-line" style={{ height: alto }}>
              {franjas.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-label={`Agendar con ${p.nombreCompleto} a las ${aHora(m)}`}
                  onClick={() => onNueva(aHora(m), p.uid)}
                  className={cn(
                    "block w-full border-t border-line hover:bg-accent-wash focus-visible:relative focus-visible:z-10",
                    !habil && "bg-bg",
                  )}
                  style={{ height: franjaMin * PX_POR_MIN }}
                />
              ))}
              {(porProfesional.get(p.uid) ?? []).map(({ cita, carril, carriles }) => {
                const inicioMin = aMinutos(horaDe(cita.inicio));
                const finMin = cita.fin.slice(0, 10) === dia ? aMinutos(horaDe(cita.fin)) : 24 * 60;
                const top = (inicioMin - desde) * PX_POR_MIN;
                const height = Math.max(ALTO_MIN_CITA, (finMin - inicioMin) * PX_POR_MIN);
                return (
                  <button
                    key={cita.appointmentId}
                    type="button"
                    onClick={() => onAbrir(cita)}
                    title={`${cita.pacienteNombre} · ${ETIQUETA_ESTADO[cita.estado]}`}
                    className={cn(
                      "absolute overflow-hidden rounded-md border p-1.5 text-left text-13 leading-tight transition-colors",
                      cita.estado === "atendida" && "border-ok/40 bg-ok/10 text-ok",
                      cita.estado === "confirmada" && "border-accent/40 bg-accent-wash text-accent",
                      cita.estado === "pendiente" && "border-warn/40 bg-warn/10 text-warn",
                    )}
                    style={{
                      top,
                      height,
                      left: `calc(${(carril / carriles) * 100}% + 2px)`,
                      width: `calc(${100 / carriles}% - 4px)`,
                    }}
                  >
                    <span className="block font-mono">
                      {horaDe(cita.inicio)}–{horaDe(cita.fin)}
                    </span>
                    <span className="block truncate font-medium">{cita.pacienteNombre}</span>
                    {height > 48 && cita.motivo && <span className="block truncate opacity-80">{cita.motivo}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {liberadas.length > 0 && (
        <section aria-label="Canceladas y ausentes">
          <h2 className="mb-2 text-13 font-medium text-ink-soft">Canceladas y ausentes ({liberadas.length})</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {liberadas.map((c) => (
              <li key={c.appointmentId}>
                <TarjetaCita cita={c} onClick={onAbrir} mostrarProfesional />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

interface ListaDiaProps {
  dia: string;
  citas: Cita[];
  /** Con más de un profesional visible se indica de quién es cada cita. */
  mostrarProfesional: boolean;
  onNueva: () => void;
  onAbrir: (cita: Cita) => void;
}

/** Línea de tiempo vertical para móvil: un día, citas ordenadas por hora. */
export function ListaDia({ dia, citas, mostrarProfesional, onNueva, onAbrir }: ListaDiaProps) {
  if (citas.length === 0) {
    return (
      <EmptyState
        title="Sin citas este día"
        description={`No hay nada agendado para el ${dia}.`}
        action={
          <button
            type="button"
            onClick={onNueva}
            className="min-h-touch rounded-md bg-accent px-4 text-sm font-medium text-accent-ink"
          >
            Agendar cita
          </button>
        }
      />
    );
  }
  return (
    <ol className="space-y-2">
      {citas.map((c) => (
        <li key={c.appointmentId}>
          <TarjetaCita cita={c} onClick={onAbrir} mostrarProfesional={mostrarProfesional} />
        </li>
      ))}
    </ol>
  );
}
