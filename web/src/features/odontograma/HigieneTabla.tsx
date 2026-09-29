import type { IndiceHigieneDiente } from "@cident/shared";
import { HYGIENE_LIMITS, HYGIENE_TEETH } from "@cident/shared";
import { DataList, NumberStepper } from "../../components/ui";
import type { Columna } from "../../components/ui";

type Indicador = keyof typeof HYGIENE_LIMITS;

const INDICADORES: { indicador: Indicador; etiqueta: string }[] = [
  { indicador: "placa", etiqueta: "Placa" },
  { indicador: "calculo", etiqueta: "Cálculo" },
  { indicador: "gingivitis", etiqueta: "Gingivitis" },
];

interface HigieneTablaProps {
  dientes: Record<string, IndiceHigieneDiente>;
  soloLectura: boolean;
  onCambiar: (fdi: number, indicador: Indicador, valor: number) => void;
}

/** Índices de higiene de las 18 piezas índice: tarjetas por diente en móvil, tabla desde md. */
export function HigieneTabla({ dientes, soloLectura, onCambiar }: HigieneTablaProps) {
  const columnas: Columna<number>[] = [
    {
      id: "diente",
      header: "Diente",
      cell: (fdi) => <span className="font-mono font-medium">{fdi}</span>,
    },
    ...INDICADORES.map(({ indicador, etiqueta }): Columna<number> => {
      const [min, max] = HYGIENE_LIMITS[indicador];
      return {
        id: indicador,
        header: `${etiqueta} (${min}–${max})`,
        cell: (fdi) => (
          <NumberStepper
            label={`Diente ${fdi}, ${etiqueta.toLowerCase()}`}
            value={dientes[String(fdi)]?.[indicador] ?? 0}
            min={min}
            max={max}
            disabled={soloLectura}
            onChange={(valor) => onCambiar(fdi, indicador, Math.min(max, Math.max(min, valor)))}
          />
        ),
      };
    }),
  ];

  return (
    <DataList
      caption="Índices de higiene por diente"
      items={[...HYGIENE_TEETH]}
      columns={columnas}
      rowKey={(fdi) => String(fdi)}
    />
  );
}
