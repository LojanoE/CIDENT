import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "../../components/ui";

/** Tope de ancho al exportar: mantiene el PNG muy por debajo del límite del servidor. */
const ANCHO_EXPORT = 600;

export interface FirmaCanvasProps {
  /** Recibe el PNG recortado (data URL) o `null` si el lienzo está vacío. */
  onChange: (png: string | null) => void;
  className?: string;
}

/** Lienzo de firma con mouse, dedo o lápiz (pointer events), sin librerías. */
export function FirmaCanvas({ onChange, className }: FirmaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const hayTrazo = useRef(false);
  const [vacio, setVacio] = useState(true);

  const preparar = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
    hayTrazo.current = false;
    setVacio(true);
    onChange(null);
  }, [onChange]);

  useEffect(() => {
    preparar();
    // Solo al montar: redimensionar borraría la firma en curso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function punto(e: PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function alBajar(e: PointerEvent<HTMLCanvasElement>) {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const { x, y } = punto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y);
    ctx.stroke();
  }

  function alMover(e: PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = punto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hayTrazo.current = true;
  }

  function alSoltar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    if (hayTrazo.current) {
      setVacio(false);
      onChange(exportar());
    }
  }

  /** PNG recortado al trazo, con fondo transparente. */
  function exportar(): string | null {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return null;
    const { width, height } = canvas;
    const datos = ctx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((datos[(y * width + x) * 4 + 3] ?? 0) > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    const margen = 6;
    const sx = Math.max(0, minX - margen);
    const sy = Math.max(0, minY - margen);
    const sw = Math.min(width - sx, maxX - minX + 1 + margen * 2);
    const sh = Math.min(height - sy, maxY - minY + 1 + margen * 2);
    const escala = Math.min(1, ANCHO_EXPORT / sw);
    const salida = document.createElement("canvas");
    salida.width = Math.max(1, Math.round(sw * escala));
    salida.height = Math.max(1, Math.round(sh * escala));
    salida.getContext("2d")?.drawImage(canvas, sx, sy, sw, sh, 0, 0, salida.width, salida.height);
    return salida.toDataURL("image/png");
  }

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        aria-label="Área de firma"
        className="h-48 w-full touch-none rounded-md border border-dashed border-line bg-white"
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
      />
      <div className="mt-2 flex items-center justify-between text-13 text-ink-soft">
        <span>{vacio ? "Firme dentro del recuadro." : "Firma capturada."}</span>
        <Button type="button" variant="ghost" size="sm" onClick={preparar}>
          Borrar
        </Button>
      </div>
    </div>
  );
}
