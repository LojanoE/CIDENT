import { describe, expect, it } from "vitest";
import {
  anchoDePieza,
  apariencia,
  direccionDeZona,
  longitudHemiarco,
  margenGingival,
  posicionPieza,
  tipoDePieza,
} from "./arcada3d.js";
import { FDI_PERMANENTES, FDI_TEMPORALES } from "./odontograma.js";
import type { EstadoDiente } from "./types.js";

describe("tipoDePieza", () => {
  it("clasifica permanentes y temporales", () => {
    expect(tipoDePieza(11)).toBe("incisivo");
    expect(tipoDePieza(43)).toBe("canino");
    expect(tipoDePieza(25)).toBe("premolar");
    expect(tipoDePieza(36)).toBe("molar");
    expect(tipoDePieza(54)).toBe("molar");
    expect(tipoDePieza(83)).toBe("canino");
  });
});

describe("posicionPieza", () => {
  it("cuadrantes 1 y 2 son simétricos respecto a la línea media", () => {
    const a = posicionPieza(13);
    const b = posicionPieza(23);
    expect(a.x).toBeCloseTo(-b.x);
    expect(a.z).toBeCloseTo(b.z);
    expect(a.rotY).toBeCloseTo(-b.rotY);
  });

  it("cuadrantes 1/4 quedan a la izquierda de quien mira y 2/3 a la derecha", () => {
    expect(posicionPieza(16).x).toBeLessThan(0);
    expect(posicionPieza(46).x).toBeLessThan(0);
    expect(posicionPieza(26).x).toBeGreaterThan(0);
    expect(posicionPieza(36).x).toBeGreaterThan(0);
  });

  it("las piezas se alejan de la línea media y hacia atrás al subir el número", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => Math.abs(posicionPieza(20 + n).x));
    const zs = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => posicionPieza(20 + n).z);
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]!);
      expect(zs[i]).toBeLessThan(zs[i - 1]!);
    }
  });

  it("solo la arcada superior va invertida", () => {
    expect(posicionPieza(11).invertido).toBe(true);
    expect(posicionPieza(61).invertido).toBe(true);
    expect(posicionPieza(31).invertido).toBe(false);
    expect(posicionPieza(81).invertido).toBe(false);
  });

  it.each([
    ["adulto", FDI_PERMANENTES],
    ["infantil", FDI_TEMPORALES],
  ])("dentición %s: ninguna pieza vecina se solapa", (_nombre, lista) => {
    for (const fdi of lista) {
      const vecino = fdi % 10 + 1;
      const siguiente = fdi - (fdi % 10) + vecino;
      if (!lista.includes(siguiente)) continue;
      const p = posicionPieza(fdi);
      const q = posicionPieza(siguiente);
      const distancia = Math.hypot(p.x - q.x, p.z - q.z);
      // La cuerda es algo menor que el arco, de ahí la tolerancia.
      const minimo = (anchoDePieza(fdi) + anchoDePieza(siguiente)) / 2;
      expect(distancia).toBeGreaterThan(minimo * 0.9);
    }
  });
});

describe("margenGingival", () => {
  it("baja en el centro de cada pieza y sube en las papilas", () => {
    // Incisivo central permanente: ocupa [0.03, 0.88).
    expect(margenGingival(0.03 + 0.85 / 2, false)).toBeCloseTo(0);
    expect(margenGingival(0.03, false)).toBeCloseTo(1);
    expect(margenGingival(0.03 + 0.85 + 0.001, false)).toBeCloseTo(1, 1);
  });

  it("fuera del hemiarco devuelve 1", () => {
    expect(margenGingival(longitudHemiarco(false) + 1, false)).toBe(1);
    expect(margenGingival(longitudHemiarco(true) + 1, true)).toBe(1);
  });

  it("el hemiarco temporal es más corto que el permanente", () => {
    expect(longitudHemiarco(true)).toBeLessThan(longitudHemiarco(false));
  });
});

describe("direccionDeZona", () => {
  it("mesial apunta a la línea media en los cuatro cuadrantes", () => {
    for (const fdi of [11, 21, 31, 41]) {
      const p = posicionPieza(fdi);
      const [dx] = direccionDeZona(fdi, "mesial");
      // Moverse hacia mesial desde la pieza debe reducir |x|.
      expect(Math.abs(p.x + dx * 0.1)).toBeLessThan(Math.abs(p.x));
    }
  });

  it("distal es lo opuesto a mesial", () => {
    const m = direccionDeZona(26, "mesial");
    const d = direccionDeZona(26, "distal");
    expect(m[0]).toBe(-d[0]);
  });
});

describe("apariencia", () => {
  const zona = (estados: EstadoDiente["zonas"]): EstadoDiente => ({ zonas: estados });

  it("pieza sin datos: sana y sin colores", () => {
    const a = apariencia(undefined);
    expect(a.ausente).toBe(false);
    expect(a.coloresZona.oclusal).toBeNull();
  });

  it("detecta ausencia, corona, endodoncia y extracción indicada", () => {
    const perdida = apariencia({ zonas: {}, general: { estados: ["Pérdida por Caries"], color: "#00f", nota: "" } });
    expect(perdida.ausente).toBe(true);
    expect(apariencia(zona({ oclusal: { estados: ["Corona"], color: "#fa0", nota: "" } })).corona).toBe(true);
    expect(apariencia(zona({ oclusal: { estados: ["Endodoncia"], color: "#00f", nota: "" } })).endodoncia).toBe(true);
    expect(
      apariencia(zona({ oclusal: { estados: ["Extracción Indicada"], color: "#f00", nota: "" } })).extraccionIndicada,
    ).toBe(true);
  });

  it("el color de la zona gana al color general", () => {
    const a = apariencia({
      general: { estados: ["Sano"], color: "#111111", nota: "" },
      zonas: { mesial: { estados: ["Caries"], color: "#ff0000", nota: "" } },
    });
    expect(a.coloresZona.mesial).toBe("#ff0000");
    expect(a.coloresZona.distal).toBe("#111111");
  });
});
