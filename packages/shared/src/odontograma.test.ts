import { describe, expect, it } from "vitest";
import {
  arcadaDe,
  cuadranteDe,
  FDI_PERMANENTES,
  FDI_TEMPORALES,
  ladoMesialEnSvg,
  zonaDeLado,
} from "./odontograma.js";

describe("secuencias de dibujo FDI", () => {
  it("permanentes: 18→11 | 21→28 arriba y 48→41 | 31→38 abajo", () => {
    expect(FDI_PERMANENTES.slice(0, 16)).toEqual([18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]);
    expect(FDI_PERMANENTES.slice(16)).toEqual([48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]);
  });

  it("temporales: 55→51 | 61→65 arriba y 85→81 | 71→75 abajo", () => {
    expect(FDI_TEMPORALES.slice(0, 10)).toEqual([55, 54, 53, 52, 51, 61, 62, 63, 64, 65]);
    expect(FDI_TEMPORALES.slice(10)).toEqual([85, 84, 83, 82, 81, 71, 72, 73, 74, 75]);
  });

  it("el lado mesial de las piezas junto a la línea media mira hacia ella", () => {
    for (const secuencia of [FDI_PERMANENTES, FDI_TEMPORALES]) {
      const mitad = secuencia.length / 2;
      for (const inicio of [0, mitad]) {
        const izquierda = secuencia[inicio + mitad / 2 - 1]!;
        const derecha = secuencia[inicio + mitad / 2]!;
        expect(ladoMesialEnSvg(izquierda)).toBe("derecha");
        expect(ladoMesialEnSvg(derecha)).toBe("izquierda");
      }
    }
  });
});

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
