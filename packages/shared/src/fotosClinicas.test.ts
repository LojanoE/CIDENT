import { describe, expect, it } from "vitest";
import { adjuntosDePieza, parsearPiezas, parsearToma, piezasDeToma } from "./fotosClinicas.js";

describe("piezasDeToma", () => {
  it("frontal cubre de canino a canino en ambas arcadas", () => {
    const p = piezasDeToma("frontal");
    expect(p).toHaveLength(12);
    expect(p).toContain(13);
    expect(p).toContain(33);
    expect(p).not.toContain(14);
  });

  it("lateral derecha toma los cuadrantes 1 y 4 de canino a molar", () => {
    const p = piezasDeToma("lateral_der");
    expect(p).toEqual([13, 14, 15, 16, 17, 18, 43, 44, 45, 46, 47, 48]);
  });

  it("oclusal superior son las 16 piezas de arriba", () => {
    expect(piezasDeToma("oclusal_sup")).toHaveLength(16);
  });

  it("usa numeración temporal para dentición temporal", () => {
    expect(piezasDeToma("oclusal_inf", "temporal")).toEqual([71, 72, 73, 74, 75, 81, 82, 83, 84, 85]);
  });

  it("las tomas por pieza no deducen piezas", () => {
    expect(piezasDeToma("primer_plano")).toEqual([]);
    expect(piezasDeToma("radiografia")).toEqual([]);
  });
});

describe("parsearPiezas / parsearToma", () => {
  it("descarta FDI inválidas y duplicados", () => {
    expect(parsearPiezas("16, 11,99,abc,16")).toEqual([11, 16]);
    expect(parsearPiezas(undefined)).toEqual([]);
  });
  it("solo acepta tomas conocidas", () => {
    expect(parsearToma("frontal")).toBe("frontal");
    expect(parsearToma("xx")).toBeUndefined();
  });
});

describe("adjuntosDePieza", () => {
  it("filtra por pieza y ordena por fecha", () => {
    const lista = [
      { piezas: [16], createdAt: "2026-02-01" },
      { piezas: [11], createdAt: "2026-01-01" },
      { piezas: [16, 17], createdAt: "2026-01-15" },
      { createdAt: "2026-03-01" },
    ];
    expect(adjuntosDePieza(16, lista).map((a) => a.createdAt)).toEqual(["2026-01-15", "2026-02-01"]);
  });
});
