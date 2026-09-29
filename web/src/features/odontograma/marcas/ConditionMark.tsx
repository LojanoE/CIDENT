import type { Condicion } from "@cident/shared";
import { CONDITION_SYMBOLS } from "@cident/shared";

/**
 * Marcas SVG vectoriales para cada condición, en lugar de los glifos Unicode
 * `●▲■○` de `CONDITION_SYMBOLS` (que dependen de la fuente del sistema y se
 * ven distinto en cada navegador). Se dibujan centradas en (0,0) dentro de
 * un radio de referencia `r`, para poder posicionarse con un `transform`
 * externo sobre cualquier zona del diente.
 */
export function ConditionMark({
  condicion,
  color,
  r = 5,
}: {
  condicion: Condicion;
  color: string;
  r?: number;
}) {
  const marca = CONDITION_SYMBOLS[condicion];

  switch (marca) {
    case "circulo":
      return <circle r={r} fill={color} stroke="none" />;
    case "circulo-hueco":
      return <circle r={r} fill="none" stroke={color} strokeWidth={1.5} />;
    case "triangulo": {
      const puntos = [
        [0, -r],
        [r * 0.87, r * 0.5],
        [-r * 0.87, r * 0.5],
      ]
        .map(([x, y]) => `${x},${y}`)
        .join(" ");
      return <polygon points={puntos} fill={color} stroke="none" />;
    }
    case "cuadrado":
      return <rect x={-r * 0.8} y={-r * 0.8} width={r * 1.6} height={r * 1.6} fill={color} stroke="none" />;
    case "igual":
      return (
        <g stroke={color} strokeWidth={1.5}>
          <line x1={-r} y1={-r * 0.35} x2={r} y2={-r * 0.35} />
          <line x1={-r} y1={r * 0.35} x2={r} y2={r * 0.35} />
        </g>
      );
    case "asterisco":
      return (
        <g stroke={color} strokeWidth={1.3}>
          <line x1={0} y1={-r} x2={0} y2={r} />
          <line x1={-r * 0.87} y1={-r * 0.5} x2={r * 0.87} y2={r * 0.5} />
          <line x1={-r * 0.87} y1={r * 0.5} x2={r * 0.87} y2={-r * 0.5} />
        </g>
      );
    case "aspa":
      return (
        <g stroke={color} strokeWidth={1.8}>
          <line x1={-r} y1={-r} x2={r} y2={r} />
          <line x1={-r} y1={r} x2={r} y2={-r} />
        </g>
      );
    case "puente":
      return (
        <g stroke={color} strokeWidth={1.5} fill="none">
          <path d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0`} />
        </g>
      );
    case "parentesis":
      return (
        <g stroke={color} strokeWidth={1.5} fill="none">
          <path d={`M ${-r * 0.5} ${-r} A ${r} ${r} 0 0 0 ${-r * 0.5} ${r}`} />
          <path d={`M ${r * 0.5} ${-r} A ${r} ${r} 0 0 1 ${r * 0.5} ${r}`} />
        </g>
      );
    default:
      return null;
  }
}
