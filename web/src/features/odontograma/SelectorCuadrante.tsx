import type { TipoOdontograma } from "@cident/shared";
import { cn } from "../../lib/cn";
import { mapaCuadrantes, rangoDeCuadrante } from "./geometria";

interface SelectorCuadranteProps {
  tipo: TipoOdontograma;
  activo: number;
  onCambiar: (cuadrante: number) => void;
  className?: string;
}

/**
 * Mapa 2×2 de la boca. Sigue la misma disposición que las arcadas completas y sirve de
 * navegación en móvil: un toque lleva a los dientes de ese cuadrante.
 */
export function SelectorCuadrante({ tipo, activo, onCambiar, className }: SelectorCuadranteProps) {
  const mapa = mapaCuadrantes(tipo);

  return (
    <div role="group" aria-label="Cuadrante de la boca" className={cn("grid grid-cols-2 gap-2", className)}>
      {mapa.flat().map((cuadrante) => {
        const rango = rangoDeCuadrante(tipo, cuadrante);
        const esActivo = cuadrante === activo;
        return (
          <button
            key={cuadrante}
            type="button"
            aria-pressed={esActivo}
            aria-label={`Cuadrante ${cuadrante}, dientes ${rango.replace("–", " a ")}`}
            onClick={() => onCambiar(cuadrante)}
            className={cn(
              "flex min-h-touch flex-col items-start justify-center rounded-md border px-3 py-2 text-left transition-colors",
              esActivo
                ? "border-accent bg-accent-wash text-accent"
                : "border-input bg-surface text-ink hover:bg-accent-wash/60",
            )}
          >
            <span className="text-sm font-semibold">Cuadrante {cuadrante}</span>
            <span className="font-mono text-13 text-ink-soft">{rango}</span>
          </button>
        );
      })}
    </div>
  );
}
