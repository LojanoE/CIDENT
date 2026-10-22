import { useEffect, useState } from "react";
import { obtenerTokensConfirmacion, urlConfirmacionCita } from "./agendaApi";

/**
 * URLs de confirmación por `appointmentId`. `null` = no se pudo obtener (sin red o sin la clave
 * configurada): quien llame envía el recordatorio sin enlace. `undefined` = todavía cargando.
 */
export function useEnlacesConfirmacion(appointmentIds: string[], activo: boolean) {
  const clave = appointmentIds.join(",");
  const [enlaces, setEnlaces] = useState<Record<string, string> | null | undefined>(undefined);

  useEffect(() => {
    if (!activo || !clave) {
      setEnlaces(undefined);
      return;
    }
    let vivo = true;
    setEnlaces(undefined);
    obtenerTokensConfirmacion(clave.split(","))
      .then((tokens) => {
        if (!vivo) return;
        setEnlaces(Object.fromEntries(Object.entries(tokens).map(([id, t]) => [id, urlConfirmacionCita(t)])));
      })
      .catch(() => vivo && setEnlaces(null));
    return () => {
      vivo = false;
    };
  }, [clave, activo]);

  return enlaces;
}
