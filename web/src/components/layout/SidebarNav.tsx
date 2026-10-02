import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { Sesion } from "../../app/AuthProvider";
import { cn } from "../../lib/cn";
import { etiquetaRol, itemsNavegacion } from "./navegacion";

interface SidebarNavProps {
  rol: Sesion["rol"] | undefined;
  nombreCentro: string | null;
  logoUrl: string;
  colapsado: boolean;
  onAlternar: () => void;
  onLogout: () => void;
}

/** Navegación lateral de escritorio (md+). Colapsable a solo iconos. */
export function SidebarNav({ rol, nombreCentro, logoUrl, colapsado, onAlternar, onLogout }: SidebarNavProps) {
  const items = itemsNavegacion(rol);
  const etiqueta = colapsado ? "sr-only" : "truncate";

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface md:flex",
        colapsado ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex min-h-16 items-center gap-3 border-b border-line px-3", colapsado && "justify-center")}>
        <img src={logoUrl} alt="Logo del centro" className="h-8 w-8 shrink-0 object-contain" />
        {!colapsado && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight" title={nombreCentro ?? undefined}>
              {nombreCentro ?? " "}
            </p>
            <p className="truncate text-xs text-ink-soft">{etiquetaRol(rol)}</p>
          </div>
        )}
      </div>

      <nav aria-label="Principal" className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {items.map(({ to, label, icon: Icono, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                title={colapsado ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-touch items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                    colapsado && "justify-center px-0",
                    isActive ? "bg-accent-wash text-accent" : "text-ink-soft hover:bg-bg hover:text-ink",
                  )
                }
              >
                <Icono aria-hidden className="h-5 w-5 shrink-0" />
                <span className={etiqueta}>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-1 border-t border-line p-2">
        <button
          type="button"
          onClick={onLogout}
          title={colapsado ? "Cerrar sesión" : undefined}
          className={cn(
            "flex min-h-touch w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-ink-soft hover:bg-bg hover:text-ink",
            colapsado && "justify-center px-0",
          )}
        >
          <LogOut aria-hidden className="h-5 w-5 shrink-0" />
          <span className={etiqueta}>Cerrar sesión</span>
        </button>
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={!colapsado}
          title={colapsado ? "Expandir menú" : undefined}
          className={cn(
            "flex min-h-touch w-full items-center gap-3 rounded-md px-3 text-sm text-ink-soft hover:bg-bg hover:text-ink",
            colapsado && "justify-center px-0",
          )}
        >
          {colapsado ? (
            <PanelLeftOpen aria-hidden className="h-5 w-5 shrink-0" />
          ) : (
            <PanelLeftClose aria-hidden className="h-5 w-5 shrink-0" />
          )}
          <span className={etiqueta}>{colapsado ? "Expandir menú" : "Contraer menú"}</span>
        </button>
        {!colapsado && (
          <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[11px] text-ink-soft">
            <img src="/luna-dental-logo.svg" alt="" aria-hidden className="h-3 w-3" />
            con Luna-Dental
          </p>
        )}
      </div>
    </aside>
  );
}
