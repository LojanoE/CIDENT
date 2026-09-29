import { diaDe, diasDeLaSemana, esDiaHabil, ocupaFranja, type Cita } from "@cident/shared";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { cn } from "../../lib/cn";
import { TarjetaCita } from "./TarjetaCita";
import { etiquetaDiaCorta } from "./fechas";

interface VistaSemanaProps {
  /** Cualquier día de la semana a mostrar (se muestra de lunes a domingo). */
  dia: string;
  hoy: string;
  citas: Cita[];
  onNueva: (dia: string) => void;
  onAbrir: (cita: Cita) => void;
  onIrADia: (dia: string) => void;
}

/** Siete columnas (lunes a domingo) para un solo profesional. */
export function VistaSemana({ dia, hoy, citas, onNueva, onAbrir, onIrADia }: VistaSemanaProps) {
  const dias = useMemo(() => diasDeLaSemana(dia), [dia]);
  const porDia = useMemo(() => {
    const mapa = new Map<string, Cita[]>(dias.map((d) => [d, []]));
    for (const c of citas) mapa.get(diaDe(c.inicio))?.push(c);
    return mapa;
  }, [dias, citas]);

  return (
    <div className="grid gap-3 md:grid-cols-7">
      {dias.map((d) => {
        const delDia = porDia.get(d) ?? [];
        const activas = delDia.filter((c) => ocupaFranja(c.estado)).length;
        const habil = esDiaHabil(d);
        return (
          <section
            key={d}
            aria-label={etiquetaDiaCorta(d)}
            className={cn(
              "flex min-h-32 flex-col rounded-lg border bg-surface p-2 shadow-card",
              d === hoy ? "border-accent" : "border-line",
              !habil && "bg-bg",
            )}
          >
            <header className="mb-2 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => onIrADia(d)}
                className={cn(
                  "rounded-md px-1.5 text-left text-13 font-medium hover:bg-accent-wash",
                  d === hoy && "text-accent",
                )}
              >
                {etiquetaDiaCorta(d)}
                {activas > 0 && <span className="ml-1 font-mono text-xs text-ink-soft">{activas}</span>}
              </button>
              <button
                type="button"
                aria-label={`Agendar el ${etiquetaDiaCorta(d)}`}
                onClick={() => onNueva(d)}
                className="-m-1 flex h-9 w-9 items-center justify-center rounded-md text-ink-soft hover:bg-accent-wash hover:text-accent"
              >
                <Plus aria-hidden className="h-4 w-4" />
              </button>
            </header>
            <ul className="space-y-1.5">
              {delDia.map((c) => (
                <li key={c.appointmentId}>
                  <TarjetaCita cita={c} onClick={onAbrir} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
