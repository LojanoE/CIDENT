import { RefreshCw } from "lucide-react";
import { aplicarActualizacion, useHayActualizacion } from "../../lib/actualizacionApp";

/** Banner «Hay una versión nueva»: no recarga sola para no perder lo que se esté escribiendo. */
export function AvisoActualizacion() {
  const hayNueva = useHayActualizacion();
  if (!hayNueva) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 bg-accent-wash px-4 py-1.5 text-xs font-medium text-ink"
    >
      <RefreshCw aria-hidden className="h-4 w-4" />
      Hay una versión nueva de Luna-Dental
      <button
        type="button"
        onClick={aplicarActualizacion}
        className="min-h-touch rounded-md bg-surface px-3 font-semibold underline md:min-h-0 md:py-0.5"
      >
        Actualizar
      </button>
    </div>
  );
}
