import { armarRecordatorio, type Cita } from "@cident/shared";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../../app/AuthProvider";
import { estiloBoton, useToast } from "../../components/ui";
import { cn } from "../../lib/cn";
import { mensajeError } from "../../lib/mensajeError";
import { useEnLinea } from "../../lib/useEnLinea";
import { enlaceWhatsApp } from "../../lib/whatsapp";
import type { useCentroActual } from "../centros/centrosApi";
import { marcarRecordatorioEnviado } from "./agendaApi";

interface BotonRecordatorioProps {
  cita: Cita;
  centro: ReturnType<typeof useCentroActual>;
  /** URL de confirmación; `undefined` mientras se pide, `null` si no se pudo (se envía sin enlace). */
  enlace: string | null | undefined;
  className?: string;
}

/** Abre WhatsApp con el recordatorio de la cita y la marca como enviada. */
export function BotonRecordatorio({ cita, centro, enlace, className }: BotonRecordatorioProps) {
  const { sesion } = useAuth();
  const enLinea = useEnLinea();
  const toast = useToast();
  const listo = enLinea && enlace !== undefined;

  return (
    <a
      href={enlaceWhatsApp(
        cita.pacienteTelefono,
        armarRecordatorio(centro.plantillaRecordatorio, {
          paciente: cita.pacienteNombre,
          inicio: cita.inicio,
          profesional: cita.profesionalNombre,
          centro: centro.nombre ?? "",
          direccion: centro.direccion,
          telefono: centro.telefono,
          enlace: enlace ?? undefined,
        }),
      )}
      target="_blank"
      rel="noreferrer"
      aria-disabled={!listo}
      onClick={(e) => {
        if (!listo || !sesion) {
          e.preventDefault();
          return;
        }
        void marcarRecordatorioEnviado(cita.appointmentId, sesion.uid).catch((err) =>
          toast.error(mensajeError(err)),
        );
      }}
      className={cn(estiloBoton({ variant: "secondary" }), !listo && "pointer-events-none opacity-50", className)}
    >
      <MessageCircle aria-hidden className="h-4 w-4" />
      {cita.recordatorioEnviadoAt ? "Recordar de nuevo" : "Recordar por WhatsApp"}
    </a>
  );
}
