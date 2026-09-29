import { describe, expect, it } from "vitest";
import { calcularPromediosHigiene } from "./higiene.js";
import type { HigieneDoc } from "./types.js";

describe("calcularPromediosHigiene", () => {
  it("devuelve 0 en todo si no hay registros", () => {
    const doc: Pick<HigieneDoc, "dientes"> = { dientes: {} };
    expect(calcularPromediosHigiene(doc)).toEqual({ placa: 0, calculo: 0, gingivitis: 0 });
  });

  it("promedia solo las piezas índice (HYGIENE_TEETH), ignorando otras", () => {
    const doc: Pick<HigieneDoc, "dientes"> = {
      dientes: {
        "11": { placa: 2, calculo: 1, gingivitis: 1 }, // pieza índice
        "12": { placa: 3, calculo: 3, gingivitis: 1 }, // NO es pieza índice → se ignora
      },
    };
    expect(calcularPromediosHigiene(doc)).toEqual({ placa: 2, calculo: 1, gingivitis: 1 });
  });

  it("ignora valores fuera de rango", () => {
    const doc: Pick<HigieneDoc, "dientes"> = {
      dientes: {
        "11": { placa: 2, calculo: 5 /* fuera de [0,3] */, gingivitis: 1 },
        "16": { placa: 4 /* fuera de rango */, calculo: 1, gingivitis: 0 },
      },
    };
    // placa: solo 11 es válida entre las dos (2) porque 16 está fuera de rango → promedio 2
    // calculo: solo 16 es válida (1) → promedio 1
    // gingivitis: ambas válidas (1, 0) → promedio 0.5
    expect(calcularPromediosHigiene(doc)).toEqual({ placa: 2, calculo: 1, gingivitis: 0.5 });
  });

  it("redondea a 2 decimales", () => {
    const doc: Pick<HigieneDoc, "dientes"> = {
      dientes: {
        "11": { placa: 1, calculo: 0, gingivitis: 0 },
        "16": { placa: 2, calculo: 0, gingivitis: 0 },
        "17": { placa: 2, calculo: 0, gingivitis: 0 },
      },
    };
    expect(calcularPromediosHigiene(doc).placa).toBeCloseTo(1.67, 2);
  });
});
