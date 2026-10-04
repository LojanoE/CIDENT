import type { EntradaHistorialDiente, ItemPlan } from "@cident/shared";
import { historialDiente } from "@cident/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Dialog, Spinner } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { obtenerOdontogramasDelPaciente } from "./odontogramaApi";

interface Props {
  patientId: string;
  centroId: string;
  /** Pieza FDI; `null` cierra el diálogo. */
  fdi: number | null;
  plan: readonly ItemPlan[];
  onCerrar: () => void;
}

/** Línea de tiempo de una pieza: qué cambió en cada atención y qué tratamientos se le hicieron. */
export function HistorialDiente({ patientId, centroId, fdi, plan, onCerrar }: Props) {
  const [entradas, setEntradas] = useState<EntradaHistorialDiente[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fdi === null) return;
    let cancelado = false;
    setEntradas(null);
    setError(null);
    obtenerOdontogramasDelPaciente(patientId, centroId)
      .then((fotos) => !cancelado && setEntradas(historialDiente(fdi, fotos, plan)))
      .catch((err) => !cancelado && setError(mensajeError(err)));
    return () => {
      cancelado = true;
    };
  }, [fdi, patientId, centroId, plan]);

  return (
    <Dialog
      open={fdi !== null}
      onClose={onCerrar}
      title={`Historial de la pieza ${fdi ?? ""}`}
      actions={
        <Button variant="secondary" onClick={onCerrar}>
          Cerrar
        </Button>
      }
    >
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {!error && !entradas && <Spinner label="Cargando historial…" />}
      {entradas && entradas.length === 0 && (
        <p className="text-sm text-ink-soft">Esta pieza no tiene registros en ninguna atención.</p>
      )}
      {entradas && entradas.length > 0 && (
        <ol className="space-y-3">
          {entradas.map((e) => (
            <li key={e.visitId} className="rounded-md border border-line p-3 text-sm">
              <Link to={`/pacientes/${patientId}/atenciones/${e.visitId}/odontograma`} className="font-medium underline">
                {e.fecha}
              </Link>
              {e.cambio && <p className="mt-1">{e.cambio}</p>}
              {e.tratamientos.map((t) => (
                <p key={t} className="mt-1 text-ink-soft">
                  ✓ {t}
                </p>
              ))}
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  );
}
