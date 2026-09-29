import type { Usuario } from "@cident/shared";
import { cn } from "../../lib/cn";

interface SelectorProfesionalProps {
  profesionales: Usuario[];
  /** `null` = «Todos» (solo si `permiteTodos`). */
  valor: string | null;
  onChange: (uid: string | null) => void;
  permiteTodos?: boolean;
  label?: string;
}

const chip =
  "min-h-touch rounded-full border px-3 text-13 font-medium transition-colors md:min-h-9";

/** Chips de profesional. `aria-pressed` comunica la selección sin depender del color. */
export function SelectorProfesional({
  profesionales,
  valor,
  onChange,
  permiteTodos = false,
  label = "Profesional",
}: SelectorProfesionalProps) {
  const estilo = (activo: boolean) =>
    cn(chip, activo ? "border-accent bg-accent-wash text-accent" : "border-line bg-surface text-ink hover:bg-accent-wash");

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {permiteTodos && (
        <button type="button" aria-pressed={valor === null} onClick={() => onChange(null)} className={estilo(valor === null)}>
          Todos
        </button>
      )}
      {profesionales.map((p) => (
        <button
          key={p.uid}
          type="button"
          aria-pressed={valor === p.uid}
          onClick={() => onChange(p.uid)}
          className={estilo(valor === p.uid)}
        >
          {p.nombreCompleto}
        </button>
      ))}
    </div>
  );
}
