import {
  ETIQUETA_TOMA,
  FDI_PERMANENTES,
  FDI_TEMPORALES,
  TIPOS_TOMA,
  TOMAS_POR_PIEZA,
  piezasDeToma,
  type Denticion,
  type TipoToma,
} from "@cident/shared";
import { useEffect, useState } from "react";
import { Button, Dialog, Select } from "../../components/ui";
import { cn } from "../../lib/cn";

export interface EtiquetasAdjunto {
  toma: TipoToma;
  piezas: number[];
}

interface Props {
  open: boolean;
  titulo: string;
  inicial: EtiquetasAdjunto;
  guardando?: boolean;
  etiquetaGuardar?: string;
  onGuardar: (etiquetas: EtiquetasAdjunto) => void;
  onCerrar: () => void;
}

/** Cuadrícula FDI de dos arcadas (derecha del paciente a la izquierda de la pantalla). */
function SelectorPiezas({
  denticion,
  seleccion,
  onCambio,
}: {
  denticion: Denticion;
  seleccion: readonly number[];
  onCambio: (piezas: number[]) => void;
}) {
  const lista = denticion === "permanente" ? FDI_PERMANENTES : FDI_TEMPORALES;
  const mitad = lista.length / 2;
  const arcadas = [lista.slice(0, mitad), lista.slice(mitad)];

  const alternar = (fdi: number) =>
    onCambio(seleccion.includes(fdi) ? seleccion.filter((p) => p !== fdi) : [...seleccion, fdi].sort((a, b) => a - b));

  return (
    <div className="space-y-2">
      {arcadas.map((arcada, i) => (
        <div key={i} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${mitad}, minmax(0, 1fr))` }}>
          {arcada.map((fdi) => {
            const activa = seleccion.includes(fdi);
            return (
              <button
                key={fdi}
                type="button"
                aria-pressed={activa}
                onClick={() => alternar(fdi)}
                className={cn(
                  "rounded border py-1 font-mono text-xs",
                  activa ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink-soft",
                )}
              >
                {fdi}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Tipo de toma + piezas que muestra una foto o radiografía. Las tomas estándar rellenan las piezas solas. */
export function EtiquetasAdjuntoDialog({ open, titulo, inicial, guardando, etiquetaGuardar = "Guardar", onGuardar, onCerrar }: Props) {
  const [toma, setToma] = useState<TipoToma>(inicial.toma);
  const [piezas, setPiezas] = useState<number[]>(inicial.piezas);
  const [denticion, setDenticion] = useState<Denticion>("permanente");

  useEffect(() => {
    if (!open) return;
    setToma(inicial.toma);
    setPiezas(inicial.piezas);
    setDenticion(inicial.piezas.some((p) => p >= 50) ? "temporal" : "permanente");
  }, [open, inicial]);

  const cambiarToma = (nueva: TipoToma) => {
    setToma(nueva);
    // Las tomas estándar deducen sus piezas; las demás conservan lo elegido.
    if (!TOMAS_POR_PIEZA.includes(nueva) && nueva !== "otro") setPiezas(piezasDeToma(nueva, denticion));
  };

  const cambiarDenticion = (nueva: Denticion) => {
    setDenticion(nueva);
    setPiezas(!TOMAS_POR_PIEZA.includes(toma) && toma !== "otro" ? piezasDeToma(toma, nueva) : []);
  };

  return (
    <Dialog
      open={open}
      onClose={onCerrar}
      title={titulo}
      className="max-w-lg"
      actions={
        <>
          <Button variant="secondary" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={() => onGuardar({ toma, piezas })} disabled={guardando}>
            {guardando ? "Guardando…" : etiquetaGuardar}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Tipo de toma</span>
          <Select value={toma} onChange={(e) => cambiarToma(e.target.value as TipoToma)}>
            {TIPOS_TOMA.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TOMA[t]}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Dentición</span>
          <Select value={denticion} onChange={(e) => cambiarDenticion(e.target.value as Denticion)}>
            <option value="permanente">Permanente</option>
            <option value="temporal">Temporal</option>
          </Select>
        </label>
      </div>
      <div className="space-y-1 text-sm">
        <p className="font-medium">
          Piezas que muestra{" "}
          <span className="font-normal text-ink-soft">
            {piezas.length === 0 ? "(ninguna seleccionada)" : `(${piezas.length})`}
          </span>
        </p>
        {TOMAS_POR_PIEZA.includes(toma) && <p className="text-13 text-ink-soft">Toca la pieza o piezas que se ven.</p>}
        <SelectorPiezas denticion={denticion} seleccion={piezas} onCambio={setPiezas} />
      </div>
    </Dialog>
  );
}
