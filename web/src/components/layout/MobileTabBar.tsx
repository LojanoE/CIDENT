import { NavLink } from "react-router-dom";
import type { Sesion } from "../../app/AuthProvider";
import { cn } from "../../lib/cn";
import { itemsNavegacion } from "./navegacion";

/** Barra inferior móvil (< md), con objetivos de 56 px. Reemplaza los enlaces «Volver a…». */
export function MobileTabBar({ rol }: { rol: Sesion["rol"] | undefined }) {
  const items = itemsNavegacion(rol);
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {items.map(({ to, label, icon: Icono, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  isActive ? "text-accent" : "text-ink-soft",
                )
              }
            >
              <Icono aria-hidden className="h-5 w-5" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
