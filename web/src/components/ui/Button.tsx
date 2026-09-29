import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export type VarianteBoton = "primary" | "secondary" | "ghost" | "danger";
export type TamanoBoton = "md" | "sm";

const variantes: Record<VarianteBoton, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent/90",
  secondary: "border border-input bg-surface text-ink hover:bg-accent-wash",
  ghost: "text-ink hover:bg-accent-wash",
  danger: "bg-danger text-accent-ink hover:bg-danger/90",
};

const tamanos: Record<TamanoBoton, string> = {
  md: "min-h-touch px-4 text-sm",
  sm: "min-h-touch px-3 text-13 md:min-h-9",
};

export interface EstiloBotonOpciones {
  variant?: VarianteBoton;
  size?: TamanoBoton;
  className?: string;
}

/** Clases de botón reutilizables para `<Link>` y `<a>` con aspecto de botón. */
export function estiloBoton({ variant = "primary", size = "md", className }: EstiloBotonOpciones = {}) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-md font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    variantes[variant],
    tamanos[size],
    className,
  );
}

export interface ButtonProps extends ComponentProps<"button">, EstiloBotonOpciones {
  loading?: boolean;
}

export function Button({ variant, size, className, loading, disabled, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={estiloBoton({ variant, size, className })}
      {...rest}
    >
      {loading && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
