import type { EstadoCita } from "@cident/shared";

export const ETIQUETA_ESTADO: Record<EstadoCita, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  atendida: "Atendida",
  cancelada: "Cancelada",
  ausente: "Ausente",
};
