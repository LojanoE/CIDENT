import { describe, expect, it } from "vitest";
import { arcadaDe, cuadranteDe, ladoMesialEnSvg, zonaDeLado } from "./odontograma.js";

describe("cuadranteDe", () => {
  it("identifica el cuadrante de piezas permanentes", () => {
    expect(cuadranteDe(18)).toBe(1);
    expect(cuadranteDe(21)).toBe(2);
    expect(cuadranteDe(38)).toBe(3);
    expect(cuadranteDe(41)).toBe(4);
  });

  it("identifica el cuadrante de piezas temporales (5→I, 6→II, 7→III, 8→IV)", () => {
    expect(cuadranteDe(55)).toBe(1);
    expect(cuadranteDe(65)).toBe(2);
    expect(cuadranteDe(75)).toBe(3);
    expect(cuadranteDe(85)).toBe(4);
  });
});

describe("arcadaDe", () => {
  it("cuadrantes 1 y 2 son superiores; 3 y 4 son inferiores", () => {
    expect(arcadaDe(18)).toBe("superior");
    expect(arcadaDe(28)).toBe("superior");
    expect(arcadaDe(38)).toBe("inferior");
    expect(arcadaDe(48)).toBe("inferior");
  });
});

describe("ladoMesialEnSvg — corrige app.py:1229-1235 (sin lateralidad)", () => {
  it("en cuadrante 1, mesial cae a la derecha del <g> (hacia la línea media)", () => {
    expect(ladoMesialEnSvg(11)).toBe("derecha");
    expect(ladoMesialEnSvg(18)).toBe("derecha");
  });

  it("en cuadrante 2, mesial cae a la izquierda del <g> (hacia la línea media)", () => {
    expect(ladoMesialEnSvg(21)).toBe("izquierda");
    expect(ladoMesialEnSvg(28)).toBe("izquierda");
  });

  it("en cuadrante 3, mesial cae a la izquierda del <g>", () => {
    expect(ladoMesialEnSvg(31)).toBe("izquierda");
  });

  it("en cuadrante 4, mesial cae a la derecha del <g>", () => {
    expect(ladoMesialEnSvg(41)).toBe("derecha");
  });
});

describe("zonaDeLado", () => {
  it("el centro siempre es oclusal", () => {
    expect(zonaDeLado(11, "centro")).toBe("oclusal");
    expect(zonaDeLado(48, "centro")).toBe("oclusal");
  });

  it("arcada superior: arriba es vestibular, abajo es lingual", () => {
    expect(zonaDeLado(11, "arriba")).toBe("vestibular");
    expect(zonaDeLado(11, "abajo")).toBe("lingual");
  });

  it("arcada inferior: abajo es vestibular, arriba es lingual (invertido respecto a la superior)", () => {
    expect(zonaDeLado(41, "abajo")).toBe("vestibular");
    expect(zonaDeLado(41, "arriba")).toBe("lingual");
  });

  it("cuadrante 1 (11): derecha del <g> es mesial, izquierda es distal", () => {
    expect(zonaDeLado(11, "derecha")).toBe("mesial");
    expect(zonaDeLado(11, "izquierda")).toBe("distal");
  });

  it("cuadrante 2 (21) es el espejo del cuadrante 1: izquierda es mesial, derecha es distal", () => {
    expect(zonaDeLado(21, "izquierda")).toBe("mesial");
    expect(zonaDeLado(21, "derecha")).toBe("distal");
  });

  it("cuadrante 4 (41) es el espejo del cuadrante 3 (31)", () => {
    expect(zonaDeLado(41, "derecha")).toBe("mesial");
    expect(zonaDeLado(31, "izquierda")).toBe("mesial");
  });
});
