import { rangoDelDia, sumarDias, type Cita } from "@cident/shared";
import { useMemo } from "react";
import { hoyLocal } from "./fechas";
import { useCitasDelRango } from "./useAgenda";

/** Citas que todavía se pueden recordar: vigentes y con teléfono. */
export function citasParaRecordar(citas: Cita[] | null): Cita[] {
  return (citas ?? []).filter(
    (c) => (c.estado === "pendiente" || c.estado === "confirmada") && c.pacienteTelefono.trim() !== "",
  );
}

/** Cuántas citas de mañana aún no tienen recordatorio enviado (para el contador del botón). */
export function useRecordatoriosPendientes(centroId: string | undefined) {
  const manana = useMemo(() => sumarDias(hoyLocal(), 1), []);
  const rango = rangoDelDia(manana);
  const { citas } = useCitasDelRango(centroId, rango.inicio, rango.fin);
  return citasParaRecordar(citas).filter((c) => !c.recordatorioEnviadoAt).length;
}
