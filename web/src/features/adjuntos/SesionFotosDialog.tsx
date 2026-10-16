import { ETIQUETA_TOMA, SET_INTRAORAL, piezasDeToma, type Denticion, type TipoToma } from "@cident/shared";
import { Camera, Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button, Dialog, Select } from "../../components/ui";

export interface FotoDeSesion {
  file: File;
  toma: TipoToma;
  piezas: number[];
}

interface Props {
  open: boolean;
  subiendo: boolean;
  onSubir: (fotos: FotoDeSesion[]) => void;
  onCerrar: () => void;
}

const INDICACION: Record<string, string> = {
  frontal: "Dientes en oclusión, labios separados con el separador. Cámara a la altura de los dientes, de frente.",
  lateral_der: "Separador en la comisura derecha del paciente. Cámara en ángulo, de canino a último molar.",
  lateral_izq: "Separador en la comisura izquierda del paciente. Cámara en ángulo, de canino a último molar.",
  oclusal_sup: "Boca bien abierta, espejo oclusal contra el paladar. Se ve la cara masticatoria de la arcada superior.",
  oclusal_inf: "Lengua hacia atrás, espejo oclusal sobre la arcada inferior. Se ve la cara masticatoria.",
};

/** Set estándar de fotos intraorales: un paso por toma, con indicaciones y opción de saltear. */
export function SesionFotosDialog({ open, subiendo, onSubir, onCerrar }: Props) {
  const [paso, setPaso] = useState(0);
  const [fotos, setFotos] = useState<Partial<Record<TipoToma, File>>>({});
  const [denticion, setDenticion] = useState<Denticion>("permanente");
  const camaraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPaso(0);
      setFotos({});
    }
  }, [open]);

  const toma = SET_INTRAORAL[paso];
  const foto = toma ? fotos[toma] : undefined;
  const previa = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto]);
  useEffect(() => () => {
    if (previa) URL.revokeObjectURL(previa);
  }, [previa]);

  const tomadas = SET_INTRAORAL.filter((t) => fotos[t]);
  const esUltimo = paso === SET_INTRAORAL.length - 1;

  const alElegir = (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (archivo && toma) setFotos((prev) => ({ ...prev, [toma]: archivo }));
  };

  const terminar = () => {
    onSubir(
      tomadas.map((t) => ({ file: fotos[t] as File, toma: t, piezas: piezasDeToma(t, denticion) })),
    );
  };

  if (!toma) return null;

  return (
    <Dialog
      open={open}
      onClose={subiendo ? () => undefined : onCerrar}
      title={`Fotos intraorales · ${paso + 1} de ${SET_INTRAORAL.length}`}
      className="max-w-lg"
      actions={
        <>
          <Button variant="secondary" disabled={subiendo} onClick={onCerrar}>
            Cancelar
          </Button>
          {paso > 0 && (
            <Button variant="secondary" disabled={subiendo} onClick={() => setPaso(paso - 1)}>
              Anterior
            </Button>
          )}
          {esUltimo ? (
            <Button disabled={subiendo || tomadas.length === 0} onClick={terminar}>
              {subiendo ? "Subiendo…" : `Guardar ${tomadas.length} foto${tomadas.length === 1 ? "" : "s"}`}
            </Button>
          ) : (
            <Button disabled={subiendo} onClick={() => setPaso(paso + 1)}>
              {foto ? "Siguiente" : "Saltear"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">{ETIQUETA_TOMA[toma]}</h3>
          <Select
            aria-label="Dentición"
            className="w-auto"
            value={denticion}
            onChange={(e) => setDenticion(e.target.value as Denticion)}
          >
            <option value="permanente">Dentición permanente</option>
            <option value="temporal">Dentición temporal</option>
          </Select>
        </div>
        <p className="text-sm text-ink-soft">{INDICACION[toma]}</p>

        {previa ? (
          <img src={previa} alt={`Vista previa: ${ETIQUETA_TOMA[toma]}`} className="max-h-64 w-full rounded-md border border-line object-contain" />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-line text-sm text-ink-soft">
            Sin foto todavía
          </div>
        )}

        <input ref={camaraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={alElegir} />
        <Button type="button" variant={foto ? "secondary" : "primary"} disabled={subiendo} onClick={() => camaraRef.current?.click()}>
          <Camera aria-hidden className="h-4 w-4" />
          {foto ? "Repetir foto" : "Tomar foto"}
        </Button>

        <ol className="flex flex-wrap gap-1.5 text-xs" aria-label="Avance del set">
          {SET_INTRAORAL.map((t, i) => (
            <li key={t}>
              <button
                type="button"
                disabled={subiendo}
                onClick={() => setPaso(i)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                  i === paso ? "border-accent text-accent" : "border-line text-ink-soft"
                }`}
              >
                {fotos[t] && <Check aria-hidden className="h-3 w-3" />}
                {ETIQUETA_TOMA[t]}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </Dialog>
  );
}
