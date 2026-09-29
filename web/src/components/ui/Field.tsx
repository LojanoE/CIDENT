import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface ContextoCampo {
  invalido: boolean;
  describedBy?: string;
  requerido: boolean;
}

const ContextoCampo = createContext<ContextoCampo>({ invalido: false, requerido: false });

/** Atributos ARIA que los controles heredan del Field que los envuelve. */
export function useAtributosCampo() {
  const { invalido, describedBy, requerido } = useContext(ContextoCampo);
  return {
    "aria-invalid": invalido || undefined,
    "aria-describedby": describedBy,
    "aria-required": requerido || undefined,
  };
}

export interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * El control queda DENTRO del label (así getByLabel y los lectores de pantalla lo resuelven
 * sin htmlFor). Ayuda y error van fuera del label para no contaminar su nombre accesible.
 */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  const idHint = hint ? `${id}-hint` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const describedBy = [idHint, idError].filter(Boolean).join(" ") || undefined;

  return (
    <ContextoCampo.Provider value={{ invalido: Boolean(error), describedBy, requerido: Boolean(required) }}>
      <div className={cn("space-y-1.5", className)}>
        <label className="block space-y-1.5 text-sm">
          <span className="block font-medium">
            {label}
            {required && (
              <span aria-hidden className="ml-0.5 text-danger">
                *
              </span>
            )}
          </span>
          {children}
        </label>
        {hint && (
          <p id={idHint} className="text-13 text-ink-soft">
            {hint}
          </p>
        )}
        {error && (
          <p id={idError} role="alert" className="text-13 font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </ContextoCampo.Provider>
  );
}
