import { HYGIENE_LIMITS, HYGIENE_TEETH } from "./odontograma.js";
import type { HigieneDoc, IndicadoresHigiene } from "./types.js";

type Indicador = keyof typeof HYGIENE_LIMITS;

function dentroDelLimite(indicador: Indicador, valor: number): boolean {
  const limite = HYGIENE_LIMITS[indicador];
  return Number.isFinite(valor) && valor >= limite[0] && valor <= limite[1];
}

/**
 * Promedia los índices de higiene (placa, cálculo, gingivitis) registrados
 * en las 18 piezas índice (`HYGIENE_TEETH`), ignorando valores fuera de
 * rango o ausentes — equivalente a `_calcular_promedios_higiene`
 * (`app.py:395-483`). Si ninguna pieza tiene un valor válido para un
 * indicador, su promedio es 0.
 */
export function calcularPromediosHigiene(doc: Pick<HigieneDoc, "dientes">): IndicadoresHigiene {
  const acumulado: Record<Indicador, { total: number; cuenta: number }> = {
    placa: { total: 0, cuenta: 0 },
    calculo: { total: 0, cuenta: 0 },
    gingivitis: { total: 0, cuenta: 0 },
  };

  for (const fdi of HYGIENE_TEETH) {
    const registro = doc.dientes[String(fdi)];
    if (!registro) continue;

    (Object.keys(acumulado) as Indicador[]).forEach((indicador) => {
      const valor = registro[indicador];
      if (dentroDelLimite(indicador, valor)) {
        acumulado[indicador].total += valor;
        acumulado[indicador].cuenta += 1;
      }
    });
  }

  const promedio = (indicador: Indicador): number => {
    const { total, cuenta } = acumulado[indicador];
    return cuenta > 0 ? Math.round((total / cuenta) * 100) / 100 : 0;
  };

  return {
    placa: promedio("placa"),
    calculo: promedio("calculo"),
    gingivitis: promedio("gingivitis"),
  };
}
