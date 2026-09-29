import { Minus, Plus } from "lucide-react";
import { cn } from "../../lib/cn";

export interface NumberStepperProps {
  value: number;
  onChange: (valor: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Nombre accesible del control (Placa, Cariados…). */
  label: string;
  disabled?: boolean;
  className?: string;
}

const acotar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Reemplaza al input numérico: botones de 44 px y valor editable a mano. */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  label,
  disabled,
  className,
}: NumberStepperProps) {
  const actual = Number.isFinite(value) ? value : min;
  const boton =
    "flex min-h-touch min-w-touch items-center justify-center text-ink hover:bg-accent-wash " +
    "disabled:cursor-not-allowed disabled:text-ink-soft/50 disabled:hover:bg-transparent";

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-md border border-input bg-surface",
        disabled && "bg-bg",
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Disminuir ${label}`}
        disabled={disabled || actual <= min}
        onClick={() => onChange(acotar(actual - step, min, max))}
        className={boton}
      >
        <Minus aria-hidden className="h-4 w-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        disabled={disabled}
        value={actual}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value.replace(/\D/g, ""), 10);
          onChange(Number.isNaN(n) ? min : acotar(n, min, max));
        }}
        onFocus={(e) => e.target.select()}
        className="w-12 min-w-0 border-x border-line bg-transparent text-center font-mono text-base tabular-nums disabled:text-ink-soft md:text-sm"
      />
      <button
        type="button"
        aria-label={`Aumentar ${label}`}
        disabled={disabled || actual >= max}
        onClick={() => onChange(acotar(actual + step, min, max))}
        className={boton}
      >
        <Plus aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
