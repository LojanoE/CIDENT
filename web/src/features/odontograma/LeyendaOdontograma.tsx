import { CONDICIONES, CONDITION_COLORS } from "@cident/shared";
import { ChevronDown } from "lucide-react";
import { ConditionMark } from "./marcas/ConditionMark";

/**
 * Leyenda de símbolos. El rojo y el azul de las condiciones se repiten entre varias de
 * ellas (por convención clínica), así que la forma de la marca es lo que las distingue.
 */
export function LeyendaOdontograma({ abierta = false }: { abierta?: boolean }) {
  return (
    <details open={abierta} className="group rounded-md border border-line bg-surface">
      <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        Leyenda de símbolos
        <ChevronDown aria-hidden className="h-4 w-4 text-ink-soft transition-transform group-open:rotate-180" />
      </summary>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 border-t border-line px-3 py-3 sm:grid-cols-2 xl:grid-cols-3">
        {CONDICIONES.map((condicion) => {
          const color = CONDITION_COLORS[condicion];
          return (
            <li key={condicion} className="flex items-center gap-2 text-13">
              <svg viewBox="-8 -8 16 16" className="h-5 w-5 shrink-0 text-ink" aria-hidden>
                <ConditionMark condicion={condicion} color="currentColor" r={5} />
              </svg>
              <span className="min-w-0 flex-1">{condicion}</span>
              {color && (
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-sm border border-input"
                  style={{ backgroundColor: color }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
