import { Building2, CalendarDays, Home, ShieldCheck, Users, Wallet, type LucideIcon } from "lucide-react";
import type { Sesion } from "../../app/AuthProvider";

export interface ItemNavegacion {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Coincidencia exacta: evita que «Inicio» o «Administración» queden activos en sus rutas hijas. */
  end?: boolean;
}

/** Única fuente de la navegación: la consumen el sidebar de escritorio y la barra inferior móvil. */
export function itemsNavegacion(rol: Sesion["rol"] | undefined): ItemNavegacion[] {
  const base: ItemNavegacion[] = [
    { to: "/", label: "Inicio", icon: Home, end: true },
    { to: "/agenda", label: "Agenda", icon: CalendarDays },
    { to: "/pacientes", label: "Pacientes", icon: Users },
    { to: "/contabilidad", label: "Contabilidad", icon: Wallet },
  ];
  if (rol === "admin") {
    base.push(
      { to: "/admin", label: "Administración", icon: ShieldCheck, end: true },
      { to: "/admin/centros", label: "Centros", icon: Building2 },
    );
  }
  return base;
}

export function etiquetaRol(rol: Sesion["rol"] | undefined): string {
  if (rol === "admin") return "Administrador";
  if (rol === "profesional") return "Profesional";
  return "";
}
