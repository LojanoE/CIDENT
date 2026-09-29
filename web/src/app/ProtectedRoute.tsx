import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type Sesion } from "./AuthProvider";

interface ProtectedRouteProps {
  children: ReactNode;
  /** Si se indica, además de requerir sesión, exige que `sesion.rol` coincida. */
  rolRequerido?: Sesion["rol"];
}

/** Bloquea el acceso hasta confirmar sesión con `centroId`/`rol` ya propagados. */
export function ProtectedRoute({ children, rolRequerido }: ProtectedRouteProps) {
  const { sesion, cargando } = useAuth();

  if (cargando) {
    return <div className="flex min-h-screen items-center justify-center">Cargando…</div>;
  }

  if (!sesion) {
    return <Navigate to="/login" replace />;
  }

  if (rolRequerido && sesion.rol !== rolRequerido) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
