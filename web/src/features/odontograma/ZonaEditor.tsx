import type { Condicion, EstadoZona, Zona } from "@cident/shared";
import { COLORS_PALETA, CONDICIONES, ZONAS, estadoZonaSchema } from "@cident/shared";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Field, Sheet, Textarea } from "../../components/ui";
import { cn } from "../../lib/cn";
import { colorSobre } from "./colores";
import { ConditionMark } from "./marcas/ConditionMark";

const ESTADO_VACIO: EstadoZona = { estados: [], color: "#000000", nota: "" };

const NOMBRE_ZONA: Record<Zona, string> = {
  vestibular: "Vestibular",
  mesial: "Mesial",
  oclusal: "Oclusal",
  distal: "Distal",
  lingual: "Lingual",
};

interface ZonaEditorProps {
  abierto: boolean;
  fdi: number | null;
  /** null = editando el diente completo (`general`), no una zona puntual */
  zona: Zona | null;
  valorInicial: EstadoZona | undefined;
  soloLectura: boolean;
  onCambiarZona: (zona: Zona | null) => void;
  onGuardar: (valor: EstadoZona) => void;
  onLimpiar: () => void;
  onCerrar: () => void;
  /** Abre la línea de tiempo de la pieza (se cierra el editor antes). */
  onVerHistorial?: () => void;
}

export function ZonaEditor({
  abierto,
  fdi,
  zona,
  valorInicial,
  soloLectura,
  onCambiarZona,
  onGuardar,
  onLimpiar,
  onCerrar,
  onVerHistorial,
}: ZonaEditorProps) {
  const [estados, setEstados] = useState<Condicion[]>([]);
  const [color, setColor] = useState("#000000");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    const base = valorInicial ?? ESTADO_VACIO;
    setEstados(base.estados);
    setColor(base.color);
    setNota(base.nota);
    setError(null);
  }, [abierto, fdi, zona, valorInicial]);

  function alternarCondicion(c: Condicion) {
    setEstados((prev) => (prev.includes(c) ? prev.filter((e) => e !== c) : [...prev, c]));
  }

  function guardar() {
    const parseado = estadoZonaSchema.safeParse({ estados, color, nota });
    if (!parseado.success) {
      setError(parseado.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    onGuardar(parseado.data);
  }

  // Ctrl/Cmd+Enter guarda desde cualquier control; Escape ya lo maneja el Sheet.
  const guardarRef = useRef(guardar);
  guardarRef.current = guardar;
  useEffect(() => {
    if (!abierto || soloLectura) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) guardarRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto, soloLectura]);

  const alcance = zona ? `Zona ${NOMBRE_ZONA[zona].toLowerCase()}` : "Diente completo";

  return (
    <Sheet
      open={abierto && fdi !== null}
      onClose={onCerrar}
      title={`Diente ${fdi}`}
      description={soloLectura ? `${alcance} · solo lectura` : alcance}
      footer={
        soloLectura ? (
          <Button variant="secondary" className="w-full" onClick={onCerrar}>
            Cerrar
          </Button>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={onLimpiar}>
              {zona ? "Limpiar zona" : "Limpiar diente"}
            </Button>
            <Button onClick={guardar}>Guardar</Button>
          </div>
        )
      }
    >
      {onVerHistorial && (
        <Button variant="ghost" size="sm" className="mb-3" onClick={onVerHistorial}>
          Historial de esta pieza
        </Button>
      )}
      <fieldset disabled={soloLectura} className="min-w-0 space-y-5 disabled:opacity-60">
        <div>
          <p className="mb-2 text-sm font-medium">Qué se edita</p>
          <div className="grid grid-cols-3 gap-2">
            {ZONAS.map((z) => (
              <ChipAlcance key={z} activo={zona === z} onClick={() => onCambiarZona(z)}>
                {NOMBRE_ZONA[z]}
              </ChipAlcance>
            ))}
            <ChipAlcance activo={zona === null} onClick={() => onCambiarZona(null)}>
              Todo el diente
            </ChipAlcance>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Condiciones</p>
          <div className="grid grid-cols-2 gap-2">
            {CONDICIONES.map((c) => {
              const activo = estados.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => alternarCondicion(c)}
                  aria-pressed={activo}
                  className={cn(
                    "flex min-h-touch items-center gap-2 rounded-md border px-2 py-1.5 text-left text-13 leading-tight",
                    activo ? "border-accent bg-accent-wash text-accent" : "border-input bg-surface text-ink",
                  )}
                >
                  <svg viewBox="-7 -7 14 14" className="h-4 w-4 shrink-0" aria-hidden>
                    <ConditionMark condicion={c} color="currentColor" r={5} />
                  </svg>
                  <span className="min-w-0 flex-1">{c}</span>
                  {activo && <Check aria-hidden className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Color</p>
          <div className="flex flex-wrap items-center gap-2">
            {COLORS_PALETA.map((muestra) => {
              const activo = color.toLowerCase() === muestra.toLowerCase();
              return (
                <button
                  key={muestra}
                  type="button"
                  aria-label={`Color ${muestra}`}
                  aria-pressed={activo}
                  onClick={() => setColor(muestra)}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full border-2",
                    activo ? "border-accent ring-2 ring-accent/30" : "border-input",
                  )}
                  style={{ backgroundColor: muestra }}
                >
                  {activo && <Check aria-hidden className="h-5 w-5" style={{ color: colorSobre(muestra) }} />}
                </button>
              );
            })}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-14 cursor-pointer rounded-md border border-input bg-surface p-1"
              aria-label="Color personalizado"
            />
          </div>
        </div>

        <Field label="Nota" hint={`${nota.length}/500`}>
          <Textarea value={nota} maxLength={500} rows={4} onChange={(e) => setNota(e.target.value)} />
        </Field>
      </fieldset>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </Sheet>
  );
}

function ChipAlcance({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "min-h-touch rounded-md border px-2 py-1.5 text-13 font-medium leading-tight",
        activo ? "border-accent bg-accent text-accent-ink" : "border-input bg-surface text-ink hover:bg-accent-wash",
      )}
    >
      {children}
    </button>
  );
}
