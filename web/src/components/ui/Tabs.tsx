import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";

export interface PestanaRuta {
  to: string;
  label: string;
  icon?: ReactNode;
  /** Coincidencia exacta de ruta (la pestaña índice). */
  end?: boolean;
}

/** Pestañas con ruta propia: la URL es el estado, así que atrás/adelante y los enlaces funcionan. */
export function Tabs({ items, label, className }: { items: PestanaRuta[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("-mx-4 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0", className)}>
      <ul className="flex min-w-max gap-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "-mb-px flex min-h-touch items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-ink-soft hover:border-line hover:text-ink",
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
