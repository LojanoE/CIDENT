import type { EnlacePortal, Presupuesto, PortalPacienteDatos } from "./types.js";

export const PORTAL_VIGENCIA_DIAS = 30;

export function enlaceVigente(
  enlace: Pick<EnlacePortal, "revocado" | "expiraAt">,
  ahora: Date = new Date(),
): boolean {
  return !enlace.revocado && new Date(enlace.expiraAt).getTime() > ahora.getTime();
}

export function expiracionPortal(desde: Date = new Date()): string {
  return new Date(desde.getTime() + PORTAL_VIGENCIA_DIAS * 24 * 60 * 60 * 1000).toISOString();
}

/** Plan visible para el paciente: solo tratamientos y piezas, jamás precios, totales ni pagos. */
export function planSinMontos(
  presupuesto: Pick<Presupuesto, "fecha" | "estado" | "lineas">,
): NonNullable<PortalPacienteDatos["plan"]> {
  return {
    fecha: presupuesto.fecha,
    estado: presupuesto.estado,
    tratamientos: presupuesto.lineas.map((l) => ({
      tratamiento: l.tratamiento,
      ...(l.pieza ? { pieza: l.pieza } : {}),
      cantidad: l.cantidad,
    })),
  };
}
