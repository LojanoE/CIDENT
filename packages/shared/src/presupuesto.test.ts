import { describe, expect, it } from "vitest";
import { calcularTotalesPresupuesto, claveTratamiento } from "./presupuesto.js";

describe("calcularTotalesPresupuesto", () => {
  it("suma líneas, aplica el descuento y luego el IVA", () => {
    const t = calcularTotalesPresupuesto(
      [
        { cantidad: 2, precioUnitario: 50 },
        { cantidad: 1, precioUnitario: 100 },
      ],
      10,
      15,
    );
    expect(t.totalesLinea).toEqual([100, 100]);
    expect(t.subtotal).toBe(200);
    expect(t.descuento).toBe(20);
    expect(t.iva).toBe(27);
    expect(t.total).toBe(207);
  });

  it("sin descuento ni IVA el total es el subtotal", () => {
    const t = calcularTotalesPresupuesto([{ cantidad: 3, precioUnitario: 0.1 }], 0, 0);
    expect(t.subtotal).toBe(0.3);
    expect(t.total).toBe(0.3);
  });

  it("redondea a centavos", () => {
    const t = calcularTotalesPresupuesto([{ cantidad: 1, precioUnitario: 33.33 }], 0, 15);
    expect(t.iva).toBe(5);
    expect(t.total).toBe(38.33);
  });
});

describe("claveTratamiento", () => {
  it("normaliza tildes, mayúsculas y espacios", () => {
    expect(claveTratamiento("  Endodoncia Unirradicular ")).toBe("endodoncia-unirradicular");
    expect(claveTratamiento("Extracción simple")).toBe("extraccion-simple");
    expect(claveTratamiento("Resina / 2 caras")).toBe("resina-2-caras");
  });
});
