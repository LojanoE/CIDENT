import { fechaIsoSchema, horaDe, rangoDelDia, sumarDias } from "@cident/shared";
import { CheckCircle2, MessageCircleCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { Badge, EmptyState, Input, Sheet, Skeleton } from "../../components/ui";
import { useCentroActual } from "../centros/centrosApi";
import { BotonRecordatorio } from "./BotonRecordatorio";
import { etiquetaDiaLarga, hoyLocal } from "./fechas";
import { citasParaRecordar } from "./recordatorios";
import { useCitasDelRango } from "./useAgenda";
import { useEnlacesConfirmacion } from "./useTokensConfirmacion";

interface RecordatoriosPanelProps {
  open: boolean;
  onClose: () => void;
}

/** Recordatorios por WhatsApp de todas las citas de un día (por defecto, mañana), uno por uno. */
export function RecordatoriosPanel({ open, onClose }: RecordatoriosPanelProps) {
  const { sesion } = useAuth();
  const centro = useCentroActual(sesion?.centroId);
  const [dia, setDia] = useState(() => sumarDias(hoyLocal(), 1));
  const rango = rangoDelDia(dia);
  const { citas, error } = useCitasDelRango(open ? sesion?.centroId : undefined, rango.inicio, rango.fin);

  const lista = useMemo(() => citasParaRecordar(citas), [citas]);
  const enlaces = useEnlacesConfirmacion(
    lista.map((c) => c.appointmentId),
    open && lista.length > 0,
  );
  const pendientes = lista.filter((c) => !c.recordatorioEnviadoAt).length;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Recordatorios de citas"
      description="Envía el recordatorio por WhatsApp; el paciente podrá confirmar o cancelar desde el enlace."
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Día de las citas"
            value={dia}
            onChange={(e) => fechaIsoSchema.safeParse(e.target.value).success && setDia(e.target.value)}
            className="w-auto"
          />
          <span className="text-13 text-ink-soft first-letter:uppercase">{etiquetaDiaLarga(dia)}</span>
        </div>

        {error ? (
          <EmptyState title="No se pudieron cargar las citas" description={error} />
        ) : !citas ? (
          <div className="space-y-2" role="status" aria-label="Cargando citas">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : lista.length === 0 ? (
          <EmptyState title="No hay citas para recordar" description="Solo se listan citas pendientes o confirmadas con teléfono." />
        ) : (
          <>
            <p className="text-sm text-ink-soft" aria-live="polite">
              {pendientes === 0 ? "Todos los recordatorios fueron enviados." : `Faltan ${pendientes} de ${lista.length}.`}
            </p>
            <ul className="space-y-2">
              {lista.map((c) => (
                <li key={c.appointmentId} className="space-y-2 rounded-lg border border-line bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-13">{horaDe(c.inicio)}</span>
                    <span className="flex items-center gap-1.5">
                      {c.confirmadaPorPacienteAt && (
                        <Badge tone="ok" icon={<CheckCircle2 aria-hidden className="h-3.5 w-3.5" />}>
                          Confirmó
                        </Badge>
                      )}
                      {c.recordatorioEnviadoAt && (
                        <Badge tone="neutral" icon={<MessageCircleCheck aria-hidden className="h-3.5 w-3.5" />}>
                          Enviado
                        </Badge>
                      )}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{c.pacienteNombre}</p>
                  <p className="text-13 text-ink-soft">{c.profesionalNombre}</p>
                  <BotonRecordatorio
                    cita={c}
                    centro={centro}
                    enlace={enlaces === undefined ? undefined : (enlaces?.[c.appointmentId] ?? null)}
                    className="w-full"
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  );
}
