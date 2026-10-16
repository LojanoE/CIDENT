import { ETIQUETA_TOMA, type Adjunto } from "@cident/shared";
import { Button, Dialog } from "../../components/ui";
import { useUrlAdjunto } from "./adjuntosApi";

function Lado({ titulo, adjunto }: { titulo: string; adjunto: Adjunto }) {
  const url = useUrlAdjunto(adjunto.archivo.storagePath);
  return (
    <figure className="space-y-1">
      <figcaption className="text-sm">
        <span className="font-medium">{titulo}</span> · {adjunto.fecha}
        {adjunto.toma && <span className="text-ink-soft"> · {ETIQUETA_TOMA[adjunto.toma]}</span>}
      </figcaption>
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-line bg-bg">
        {url ? (
          <img src={url} alt={`${titulo}, ${adjunto.fecha}`} className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm text-ink-soft">Cargando…</span>
        )}
      </div>
    </figure>
  );
}

interface Props {
  /** Las dos fotos a comparar; se ordenan solas por fecha (antes a la izquierda). `null` cierra. */
  fotos: [Adjunto, Adjunto] | null;
  onCerrar: () => void;
}

/** Dos fotos de la misma zona en fechas distintas, lado a lado. */
export function CompararFotosDialog({ fotos, onCerrar }: Props) {
  const [antes, despues] = fotos
    ? [...fotos].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [null, null];

  return (
    <Dialog
      open={fotos !== null}
      onClose={onCerrar}
      title="Comparar fotos"
      className="max-w-4xl"
      actions={
        <Button variant="secondary" onClick={onCerrar}>
          Cerrar
        </Button>
      }
    >
      {antes && despues && (
        <div className="grid gap-3 md:grid-cols-2">
          <Lado titulo="Antes" adjunto={antes} />
          <Lado titulo="Después" adjunto={despues} />
        </div>
      )}
    </Dialog>
  );
}
