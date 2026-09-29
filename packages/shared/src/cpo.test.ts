import { describe, expect, it } from "vitest";
import { calcularCPO } from "./cpo.js";
import type { Odontograma } from "./types.js";

function piezaGeneral(estados: string[]): Odontograma[string] {
  return { general: { estados: estados as never, color: "#000000", nota: "" }, zonas: {} };
}

describe("calcularCPO", () => {
  it("devuelve 0 en todo con un odontograma vacío", () => {
    expect(calcularCPO({})).toEqual({ c: 0, p: 0, o: 0, total: 0 });
  });

  it("clasifica cada pieza en su categoría única", () => {
    const odo: Odontograma = {
      "11": piezaGeneral(["Caries"]),
      "16": piezaGeneral(["Obturación"]),
      "26": piezaGeneral(["Pérdida"]),
    };
    expect(calcularCPO(odo)).toEqual({ c: 1, p: 1, o: 1, total: 3 });
  });

  it("ignora piezas 'Sano' o sin condiciones", () => {
    const odo: Odontograma = {
      "11": piezaGeneral(["Sano"]),
      "12": { zonas: {} },
    };
    expect(calcularCPO(odo)).toEqual({ c: 0, p: 0, o: 0, total: 0 });
  });

  it("aplica prioridad P > O > C: una pieza con Caries y Obturación cuenta como O, no como ambas", () => {
    // Corrige app.py:553-603, donde esta misma pieza sumaba 1 a c_teeth Y 1 a o_teeth,
    // haciendo que el total pudiera superar el número real de piezas.
    const odo: Odontograma = {
      "24": piezaGeneral(["Caries", "Obturación"]),
    };
    expect(calcularCPO(odo)).toEqual({ c: 0, p: 0, o: 1, total: 1 });
  });

  it("aplica prioridad P sobre O y C cuando las tres coinciden en la misma pieza", () => {
    const odo: Odontograma = {
      "36": piezaGeneral(["Caries", "Obturación", "Extracción Indicada"]),
    };
    expect(calcularCPO(odo)).toEqual({ c: 0, p: 1, o: 0, total: 1 });
  });

  it("combina condiciones generales y de zona para la misma pieza", () => {
    const odo: Odontograma = {
      "14": {
        general: { estados: ["Caries"], color: "#FF0000", nota: "" },
        zonas: {
          oclusal: { estados: ["Corona"], color: "#000000", nota: "" }, // categoría O, gana sobre C
        },
      },
    };
    expect(calcularCPO(odo)).toEqual({ c: 0, p: 0, o: 1, total: 1 });
  });

  it("el total nunca supera el número de piezas registradas (a diferencia del legado)", () => {
    const odo: Odontograma = {};
    for (const fdi of [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]) {
      odo[String(fdi)] = piezaGeneral(["Caries", "Obturación"]);
    }
    const resultado = calcularCPO(odo);
    expect(resultado.total).toBe(16);
    expect(resultado.total).toBeLessThanOrEqual(Object.keys(odo).length);
  });
});
