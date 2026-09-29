import { AlertTriangle, SearchX } from "lucide-react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { EmptyState, estiloBoton } from "../components/ui";

/** Pantalla para rutas inexistentes (catch-all). */
export function NoEncontrada() {
  return (
    <div className="mx-auto max-w-xl pt-8">
      <EmptyState
        icon={<SearchX aria-hidden className="h-8 w-8" />}
        title="Página no encontrada"
        description="La dirección no existe o ya no está disponible."
        action={
          <Link to="/" className={estiloBoton()}>
            Ir al inicio
          </Link>
        }
      />
    </div>
  );
}

/** `errorElement` del árbol autenticado: evita la pantalla en blanco ante un error de render o de carga. */
export function RutaError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NoEncontrada />;

  return (
    <div className="mx-auto max-w-xl pt-8">
      <EmptyState
        icon={<AlertTriangle aria-hidden className="h-8 w-8" />}
        title="Algo salió mal"
        description="No se pudo mostrar esta pantalla. Vuelve al inicio e inténtalo de nuevo."
        action={
          <Link to="/" className={estiloBoton()}>
            Ir al inicio
          </Link>
        }
      />
    </div>
  );
}
