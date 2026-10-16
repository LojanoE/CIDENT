import type { Adjunto, EntradaHistorialDiente, ItemPlan } from "@cident/shared";
import { adjuntosDePieza, ETIQUETA_TOMA, historialDiente } from "@cident/shared";
import { getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Dialog, Spinner } from "../../components/ui";
import { cn } from "../../lib/cn";
import { mensajeError } from "../../lib/mensajeError";
import { adjuntosCollection, useUrlAdjunto } from "../adjuntos/adjuntosApi";
import { CompararFotosDialog } from "../adjuntos/CompararFotosDialog";
import { obtenerOdontogramasDelPaciente } from "./odontogramaApi";

interface Props {
  patientId: string;
  centroId: string;
  /** Pieza FDI; `null` cierra el diálogo. */
  fdi: number | null;
  plan: readonly ItemPlan[];
  onCerrar: () => void;
}

function FotoPieza({ adjunto, elegida, onAlternar }: { adjunto: Adjunto; elegida: boolean; onAlternar: () => void }) {
  const url = useUrlAdjunto(adjunto.mimeType.startsWith("image/") ? adjunto.archivo.storagePath : undefined);
  const etiqueta = `${adjunto.toma ? ETIQUETA_TOMA[adjunto.toma] : "Foto"} del ${adjunto.fecha}`;
  return (
    <button
      type="button"
      aria-pressed={elegida}
      aria-label={etiqueta}
      onClick={onAlternar}
      className={cn("w-20 space-y-0.5 text-left text-xs", elegida && "text-accent")}
    >
      <span
        className={cn(
          "flex h-20 w-20 items-center justify-center overflow-hidden rounded border bg-bg",
          elegida ? "border-accent ring-2 ring-accent" : "border-line",
        )}
      >
        {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      </span>
      <span className="block truncate font-mono">{adjunto.fecha}</span>
    </button>
  );
}

/** Línea de tiempo de una pieza: qué cambió en cada atención y qué tratamientos se le hicieron. */
export function HistorialDiente({ patientId, centroId, fdi, plan, onCerrar }: Props) {
  const [entradas, setEntradas] = useState<EntradaHistorialDiente[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Adjunto[]>([]);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [comparando, setComparando] = useState<[Adjunto, Adjunto] | null>(null);

  useEffect(() => {
    if (fdi === null) return;
    let cancelado = false;
    setEntradas(null);
    setError(null);
    setElegidas([]);
    // Las fotos son un complemento: si falla su lectura, el historial se muestra igual.
    getDocs(query(adjuntosCollection(patientId), where("centroId", "==", centroId)))
      .then((snap) => !cancelado && setFotos(adjuntosDePieza(fdi, snap.docs.map((d) => d.data() as Adjunto))))
      .catch(() => !cancelado && setFotos([]));
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
      {fotos.length > 0 && (
        <section aria-label="Fotos de la pieza" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Fotos ({fotos.length})</h3>
            <Button
              variant="secondary"
              size="sm"
              disabled={elegidas.length !== 2}
              onClick={() => {
                const par = fotos.filter((f) => elegidas.includes(f.id));
                if (par[0] && par[1]) setComparando([par[0], par[1]]);
              }}
            >
              Comparar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {fotos.map((f) => (
              <FotoPieza
                key={f.id}
                adjunto={f}
                elegida={elegidas.includes(f.id)}
                onAlternar={() =>
                  setElegidas((prev) =>
                    prev.includes(f.id) ? prev.filter((x) => x !== f.id) : [...prev, f.id].slice(-2),
                  )
                }
              />
            ))}
          </div>
          <p className="text-13 text-ink-soft">Elige dos fotos para ver el antes y el después.</p>
        </section>
      )}
      {entradas && entradas.length === 0 && (
        <p className="text-sm text-ink-soft">
          {fotos.length > 0
            ? "El odontograma de esta pieza no ha cambiado entre atenciones."
            : "Esta pieza no tiene registros en ninguna atención."}
        </p>
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
      <CompararFotosDialog fotos={comparando} onCerrar={() => setComparando(null)} />
    </Dialog>
  );
}
