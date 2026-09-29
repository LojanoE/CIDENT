import type { Odontograma as OdontogramaData, TipoOdontograma, Zona } from "@cident/shared";
import { Diente } from "./Diente";
import { ALTO_CELDA, MARGEN, PASO, GAP, dientesDeCuadrante, mapaCuadrantes, secuenciaDe } from "./geometria";

const ETIQUETA = 14;

export interface SeleccionOdontograma {
  fdi: number;
  /** `null` = diente completo (`general`). */
  zona: Zona | null;
}

interface OdontogramaProps {
  tipo: TipoOdontograma;
  dientes: OdontogramaData;
  soloLectura: boolean;
  seleccion: SeleccionOdontograma | null;
  /** Con un cuadrante se dibujan solo sus dientes, en una rejilla táctil de dos filas. */
  cuadrante?: number | null;
  onZonaClick: (fdi: number, zona: Zona) => void;
  onGeneralClick: (fdi: number) => void;
}

export function Odontograma({
  tipo,
  dientes,
  soloLectura,
  seleccion,
  cuadrante = null,
  onZonaClick,
  onGeneralClick,
}: OdontogramaProps) {
  const nombre = tipo === "adulto" ? "adulto" : "infantil";

  function renderDiente(fdi: number) {
    return (
      <Diente
        fdi={fdi}
        estado={dientes[String(fdi)]}
        soloLectura={soloLectura}
        seleccionada={seleccion?.fdi === fdi ? seleccion.zona : null}
        generalSeleccionado={seleccion?.fdi === fdi && seleccion.zona === null}
        onZonaClick={onZonaClick}
        onGeneralClick={onGeneralClick}
      />
    );
  }

  if (cuadrante !== null) {
    const lista = dientesDeCuadrante(tipo, cuadrante);
    const columnas = Math.ceil(lista.length / 2);
    const ancho = columnas * PASO - GAP;
    const alto = 2 * ALTO_CELDA + GAP;

    return (
      <svg
        viewBox={`${-MARGEN} ${-MARGEN} ${ancho + 2 * MARGEN} ${alto + 2 * MARGEN}`}
        role="group"
        aria-label={`Odontograma ${nombre}, cuadrante ${cuadrante}`}
        className="h-auto w-full"
      >
        {lista.map((fdi, i) => (
          <g key={fdi} transform={`translate(${(i % columnas) * PASO}, ${Math.floor(i / columnas) * (ALTO_CELDA + GAP)})`}>
            {renderDiente(fdi)}
          </g>
        ))}
      </svg>
    );
  }

  const secuencia = secuenciaDe(tipo);
  const mitad = secuencia.length / 2;
  const arcadaSuperior = secuencia.slice(0, mitad);
  const arcadaInferior = secuencia.slice(mitad);
  const mapa = mapaCuadrantes(tipo);

  const ancho = mitad * PASO - GAP;
  const ySuperior = ETIQUETA;
  const yInferior = ySuperior + ALTO_CELDA + GAP + ETIQUETA;
  const alto = yInferior + ALTO_CELDA + ETIQUETA - 4;
  const xMedio = (mitad / 2) * PASO - GAP / 2;
  const yMedio = ySuperior + ALTO_CELDA + (GAP + ETIQUETA) / 2 - 2;

  const estiloRotulo = { fill: "hsl(var(--ink-soft))" } as const;
  const estiloDivisor = { stroke: "hsl(var(--line))", strokeWidth: 1 } as const;

  return (
    <svg
      viewBox={`${-MARGEN} ${-MARGEN} ${ancho + 2 * MARGEN} ${alto + 2 * MARGEN}`}
      role="group"
      aria-label={`Odontograma ${nombre}`}
      className="h-auto w-full"
    >
      {/* Divisores estructurales: línea media y separación entre arcadas */}
      <line x1={xMedio} x2={xMedio} y1={0} y2={alto - 4} style={estiloDivisor} vectorEffect="non-scaling-stroke" />
      <line x1={0} x2={ancho} y1={yMedio} y2={yMedio} style={estiloDivisor} vectorEffect="non-scaling-stroke" />

      <g aria-hidden fontSize={9} className="font-mono" style={estiloRotulo}>
        <text x={0} y={ETIQUETA - 4}>C{mapa[0][0]}</text>
        <text x={ancho} y={ETIQUETA - 4} textAnchor="end">C{mapa[0][1]}</text>
        <text x={0} y={alto - 2}>C{mapa[1][0]}</text>
        <text x={ancho} y={alto - 2} textAnchor="end">C{mapa[1][1]}</text>
      </g>

      <g transform={`translate(0, ${ySuperior})`}>
        {arcadaSuperior.map((fdi, i) => (
          <g key={fdi} transform={`translate(${i * PASO}, 0)`}>
            {renderDiente(fdi)}
          </g>
        ))}
      </g>
      <g transform={`translate(0, ${yInferior})`}>
        {arcadaInferior.map((fdi, i) => (
          <g key={fdi} transform={`translate(${i * PASO}, 0)`}>
            {renderDiente(fdi)}
          </g>
        ))}
      </g>
    </svg>
  );
}
