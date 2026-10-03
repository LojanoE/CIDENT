import { LogOut, WifiOff } from "lucide-react";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { usePrecargaAgenda } from "../../features/agenda/useAgenda";
import { useCentroActual } from "../../features/centros/centrosApi";
import { useEnLinea } from "../../lib/useEnLinea";
import { MobileTabBar } from "./MobileTabBar";
import { etiquetaRol } from "./navegacion";
import { SidebarNav } from "./SidebarNav";

const CLAVE_COLAPSADO = "cident.sidebar.colapsado";

function leerColapsado(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_COLAPSADO) === "1";
  } catch {
    return false;
  }
}

function guardarColapsado(valor: boolean) {
  try {
    window.localStorage.setItem(CLAVE_COLAPSADO, valor ? "1" : "0");
  } catch {
    // Sin almacenamiento (modo privado, datos bloqueados): la preferencia solo dura la sesión.
  }
}

/** Marco de la app autenticada: sidebar en escritorio, barra superior + inferior en móvil. */
export function AppShell() {
  const { sesion, logout } = useAuth();
  const { nombre: nombreCentro, logoUrl } = useCentroActual(sesion?.centroId);
  const [colapsado, setColapsado] = useState(leerColapsado);
  const enLinea = useEnLinea();
  usePrecargaAgenda(sesion?.centroId);

  function alternar() {
    setColapsado((prev) => {
      guardarColapsado(!prev);
      return !prev;
    });
  }

  return (
    <div className="min-h-screen md:flex">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[80] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Saltar al contenido
      </a>

      <SidebarNav
        rol={sesion?.rol}
        nombreCentro={nombreCentro}
        logoUrl={logoUrl}
        colapsado={colapsado}
        onAlternar={alternar}
        onLogout={() => void logout()}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 md:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logoUrl} alt="Logo del centro" className="h-8 w-8 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight" title={nombreCentro ?? undefined}>
                {nombreCentro ?? " "}
              </p>
              <p className="truncate text-xs text-ink-soft">{etiquetaRol(sesion?.rol)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Cerrar sesión"
            className="-mr-2 flex min-h-touch min-w-touch items-center justify-center rounded-md text-ink-soft hover:text-ink"
          >
            <LogOut aria-hidden className="h-5 w-5" />
          </button>
        </header>

        {!enLinea && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-xs font-medium text-amber-900"
          >
            <WifiOff aria-hidden className="h-4 w-4" />
            Sin conexión — mostrando la agenda guardada
          </div>
        )}

        <main
          id="contenido"
          className="flex-1 px-4 py-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:px-6 md:py-6 md:pb-6"
        >
          <Outlet />
        </main>
      </div>

      <MobileTabBar rol={sesion?.rol} />
    </div>
  );
}
