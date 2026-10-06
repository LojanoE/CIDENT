import { horaDe, type Cita, type EstadoCita } from "@cident/shared";
import { MessageCircleCheck } from "lucide-react";
import { Badge, type TonoBadge } from "../../components/ui";
import { cn } from "../../lib/cn";
import { ETIQUETA_ESTADO } from "./estados";

const TONO_ESTADO: Record<EstadoCita, TonoBadge> = {
  pendiente: "warn",
  confirmada: "accent",
  atendida: "ok",
  cancelada: "neutral",
  ausente: "danger",
};

interface TarjetaCitaProps {
  cita: Cita;
  onClick: (cita: Cita) => void;
  mostrarProfesional?: boolean;
  className?: string;
}

export function TarjetaCita({ cita, onClick, mostrarProfesional = false, className }: TarjetaCitaProps) {
  const liberada = cita.estado === "cancelada" || cita.estado === "ausente";
  return (
    <button
      type="button"
      onClick={() => onClick(cita)}
      className={cn(
        "block w-full min-h-touch rounded-md border border-line bg-surface p-2.5 text-left transition-colors hover:bg-accent-wash",
        liberada && "opacity-60",
        className,
      )}
    >
      <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="font-mono text-13">
          {horaDe(cita.inicio)}–{horaDe(cita.fin)}
        </span>
        <Badge tone={TONO_ESTADO[cita.estado]}>{ETIQUETA_ESTADO[cita.estado]}</Badge>
      </span>
      <span className={cn("mt-1 flex items-center gap-1.5 text-sm font-medium", cita.estado === "cancelada" && "line-through")}>
        {cita.pacienteNombre}
        {cita.recordatorioEnviadoAt && (
          <MessageCircleCheck aria-label="Recordatorio enviado" className="h-3.5 w-3.5 shrink-0 text-ok" />
        )}
      </span>
      {mostrarProfesional && <span className="block text-13 text-ink-soft">{cita.profesionalNombre}</span>}
      {cita.motivo && <span className="block truncate text-13 text-ink-soft">{cita.motivo}</span>}
    </button>
  );
}
