import type { Condicion, EstadoDiente, Zona } from "@cident/shared";
import { zonaDeLado } from "@cident/shared";
import { TINTA, colorSobre } from "./colores";
import { POLIGONOS, SIZE } from "./geometria";
import { ConditionMark } from "./marcas/ConditionMark";

const TRAZO = "hsl(var(--ink-soft))";
const SELECCION = "hsl(var(--accent))";

function colorDeZona(estado: EstadoDiente | undefined, zona: Zona): string {
  return estado?.zonas[zona]?.color ?? estado?.general?.color ?? "#ffffff";
}

function estadosDeZona(estado: EstadoDiente | undefined, zona: Zona): Condicion[] {
  return estado?.zonas[zona]?.estados ?? [];
}

interface DienteProps {
  fdi: number;
  estado: EstadoDiente | undefined;
  soloLectura: boolean;
  /** Zona seleccionada de este diente, si la selección es por zona. */
  seleccionada: Zona | null;
  /** El diente está seleccionado como un todo (edición de `general`). */
  generalSeleccionado?: boolean;
  onZonaClick: (fdi: number, zona: Zona) => void;
  onGeneralClick: (fdi: number) => void;
}

export function Diente({
  fdi,
  estado,
  soloLectura,
  seleccionada,
  generalSeleccionado = false,
  onZonaClick,
  onGeneralClick,
}: DienteProps) {
  // La zona seleccionada se dibuja al final para que su trazo no lo tape la zona vecina.
  const poligonos = [...POLIGONOS].sort((a, b) => {
    const pesoA = seleccionada === zonaDeLado(fdi, a.posicion) ? 1 : 0;
    const pesoB = seleccionada === zonaDeLado(fdi, b.posicion) ? 1 : 0;
    return pesoA - pesoB;
  });

  return (
    <g data-fdi={fdi}>
      {/* Fondo invisible: el doble clic edita el diente completo (`general`) */}
      <rect
        x={-2}
        y={-2}
        width={SIZE + 4}
        height={SIZE + 4}
        fill="transparent"
        onDoubleClick={() => !soloLectura && onGeneralClick(fdi)}
      >
        <title>Doble clic: editar diente {fdi} completo</title>
      </rect>

      {poligonos.map(({ posicion, puntos, centro }) => {
        const zona = zonaDeLado(fdi, posicion);
        const estados = estadosDeZona(estado, zona);
        const fill = colorDeZona(estado, zona);
        const seleccionado = seleccionada === zona;
        const etiqueta = `Diente ${fdi}, zona ${zona}: ${estados.length > 0 ? estados.join(", ") : "Sano"}`;
        const marca = colorSobre(fill);

        return (
          <g
            key={posicion}
            role="button"
            tabIndex={soloLectura ? -1 : 0}
            aria-label={etiqueta}
            onClick={() => !soloLectura && onZonaClick(fdi, zona)}
            onKeyDown={(e) => {
              if (soloLectura) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onZonaClick(fdi, zona);
              }
            }}
            style={{ cursor: soloLectura ? "default" : "pointer" }}
          >
            <polygon
              points={puntos}
              fill={fill}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              style={{ stroke: seleccionado ? SELECCION : TRAZO, strokeWidth: seleccionado ? 3 : 1 }}
            />
            {estados.slice(0, 3).map((condicion, i) => {
              const offset = (i - (Math.min(estados.length, 3) - 1) / 2) * 6;
              return (
                <g key={condicion} transform={`translate(${centro[0] + offset}, ${centro[1]})`} pointerEvents="none">
                  <ConditionMark condicion={condicion} color={marca} r={3.2} />
                </g>
              );
            })}
          </g>
        );
      })}

      {generalSeleccionado && (
        <rect
          x={-2}
          y={-2}
          width={SIZE + 4}
          height={SIZE + 4}
          rx={2}
          fill="none"
          pointerEvents="none"
          vectorEffect="non-scaling-stroke"
          style={{ stroke: SELECCION, strokeWidth: 3 }}
        />
      )}

      <text
        x={SIZE / 2}
        y={SIZE + 13}
        textAnchor="middle"
        fontSize={10}
        className="font-mono"
        pointerEvents="none"
        style={{ fill: generalSeleccionado || seleccionada ? SELECCION : TINTA, fontWeight: generalSeleccionado || seleccionada ? 600 : 400 }}
      >
        {fdi}
      </text>
    </g>
  );
}
