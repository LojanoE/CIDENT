import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Línea previa al título (p. ej. ruta de retorno o estado). */
  eyebrow?: ReactNode;
  /** Acciones de la pantalla; pasan bajo el título cuando no caben. */
  actions?: ReactNode;
  className?: string;
}

/** Encabezado de pantalla. `flex-wrap` evita el desborde de los headers previos en 360 px. */
export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 md:mb-6", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-13 text-ink-soft">{eyebrow}</div>}
        <h1 className="text-xl font-semibold leading-tight md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
