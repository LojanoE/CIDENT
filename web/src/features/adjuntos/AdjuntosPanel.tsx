import type { Adjunto } from "@cident/shared";
import { onSnapshot, query, where } from "firebase/firestore";
import { Camera, Download, Paperclip, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { Button, Card, CardBody, EmptyState, useToast } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { useAtencion } from "../atenciones/useAtencion";
import { adjuntosCollection, obtenerUrlDescarga, subirAdjunto } from "./adjuntosApi";

function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TAMANO_MAXIMO_BYTES = 25 * 1024 * 1024;

/** Pestaña «Adjuntos»: radiografías, fotos clínicas y PDF de la atención. En móvil ofrece la cámara. */
export function AdjuntosPanel() {
  const { patientId, visitId } = useParams<{ patientId: string; visitId: string }>();
  const { sesion } = useAuth();
  const { atencion } = useAtencion();
  const toast = useToast();
  const centroId = atencion.centroId;
  const soloLectura = atencion.estado !== "draft";

  const [adjuntos, setAdjuntos] = useState<Adjunto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const camaraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!patientId || !visitId) return;
    const q = query(
      adjuntosCollection(patientId),
      where("visitId", "==", visitId),
      where("centroId", "==", centroId),
    );
    return onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs.map((d) => d.data() as Adjunto);
        lista.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setAdjuntos(lista);
      },
      (err) => setError(mensajeError(err)),
    );
  }, [patientId, visitId, centroId]);

  const manejarSeleccion = async (e: ChangeEvent<HTMLInputElement>) => {
    // Se copia la lista antes de limpiar el input: vaciarlo invalida el FileList vivo.
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (archivos.length === 0 || !sesion || !patientId || !visitId) return;

    for (const file of archivos) {
      if (file.size > TAMANO_MAXIMO_BYTES) {
        toast.error(`«${file.name}» supera el tamaño máximo permitido (25 MB).`);
        continue;
      }
      setProgreso(0);
      try {
        await subirAdjunto({
          file,
          centroId: sesion.centroId,
          uid: sesion.uid,
          patientId,
          visitId,
          onProgress: setProgreso,
        });
        toast.ok(`«${file.name}» subido. Aparecerá en la lista en unos segundos.`);
      } catch (err) {
        toast.error(mensajeError(err));
      } finally {
        setProgreso(null);
      }
    }
  };

  const descargar = async (adjunto: Adjunto) => {
    try {
      const url = await obtenerUrlDescarga(adjunto.archivo.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  const subiendo = progreso !== null;

  return (
    <Card className="max-w-3xl">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Adjuntos de la atención</h3>
          {!soloLectura && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={archivoRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={manejarSeleccion}
              />
              {/* `capture` abre la cámara trasera en móvil; en escritorio se comporta como un selector. */}
              <input
                ref={camaraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={manejarSeleccion}
              />
              <Button type="button" variant="secondary" disabled={subiendo} onClick={() => camaraRef.current?.click()}>
                <Camera aria-hidden className="h-4 w-4" />
                Tomar foto
              </Button>
              <Button type="button" disabled={subiendo} onClick={() => archivoRef.current?.click()}>
                <Upload aria-hidden className="h-4 w-4" />
                {subiendo ? `Subiendo… ${progreso}%` : "Subir archivo"}
              </Button>
            </div>
          )}
        </div>

        {subiendo && (
          <div
            role="progressbar"
            aria-label="Progreso de la subida"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progreso}
            className="h-1.5 overflow-hidden rounded-full bg-line"
          >
            <div className="h-full bg-accent transition-[width]" style={{ width: `${progreso}%` }} />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        {adjuntos === null ? null : adjuntos.length === 0 ? (
          <EmptyState
            icon={<Paperclip aria-hidden className="h-8 w-8" />}
            title="No hay adjuntos para esta atención"
            description={soloLectura ? undefined : "Sube radiografías, fotos clínicas o PDF. Máximo 25 MB por archivo."}
          />
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {adjuntos.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.nombre}</p>
                  <p className="text-13 text-ink-soft">
                    <span className="font-mono">{formatoTamano(a.size)}</span> · {a.fecha}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Descargar ${a.nombre}`}
                  onClick={() => descargar(a)}
                >
                  <Download aria-hidden className="h-4 w-4" />
                  Descargar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
