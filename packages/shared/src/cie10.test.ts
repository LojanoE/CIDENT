import { describe, expect, it } from "vitest";
import { buscarCie10, CIE10_ODONTOLOGIA, separarDiagnosticos, textoCie10, unirDiagnosticos } from "./cie10.js";

describe("catálogo CIE-10", () => {
  it("no repite códigos", () => {
    const codigos = CIE10_ODONTOLOGIA.map((c) => c.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });
});

describe("buscarCie10", () => {
  it("busca por código, con o sin punto y sin importar mayúsculas", () => {
    expect(buscarCie10("K02.1")[0]?.codigo).toBe("K02.1");
    expect(buscarCie10("k021")[0]?.codigo).toBe("K02.1");
  });

  it("un prefijo de código trae toda la familia", () => {
    const codigos = buscarCie10("K02", 20).map((c) => c.codigo);
    expect(codigos).toContain("K02.0");
    expect(codigos).toContain("K02.9");
  });

  it("busca por descripción sin importar acentos", () => {
    expect(buscarCie10("pulpitis")[0]?.codigo).toBe("K04.0");
    expect(buscarCie10("EROSION")[0]?.codigo).toBe("K03.2");
  });

  it("exige todas las palabras", () => {
    const r = buscarCie10("caries dentina");
    expect(r.map((c) => c.codigo)).toEqual(["K02.1"]);
  });

  it("devuelve vacío sin texto o sin coincidencias", () => {
    expect(buscarCie10("  ")).toEqual([]);
    expect(buscarCie10("zzzz")).toEqual([]);
  });

  it("respeta el límite", () => {
    expect(buscarCie10("dent", 3)).toHaveLength(3);
  });
});

describe("textoCie10", () => {
  it("une código y descripción", () => {
    expect(textoCie10({ codigo: "K02.1", descripcion: "Caries de la dentina" })).toBe("K02.1 Caries de la dentina");
  });
});

describe("unirDiagnosticos / separarDiagnosticos", () => {
  it("son inversos y descartan vacíos", () => {
    const lista = ["K04.0 Pulpitis", "K02.1 Caries de la dentina"];
    expect(unirDiagnosticos(lista)).toBe("K04.0 Pulpitis; K02.1 Caries de la dentina");
    expect(separarDiagnosticos(unirDiagnosticos(lista))).toEqual(lista);
    expect(separarDiagnosticos(" ; ")).toEqual([]);
    expect(separarDiagnosticos(undefined)).toEqual([]);
  });
});
