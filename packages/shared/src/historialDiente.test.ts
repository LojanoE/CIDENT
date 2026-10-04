import { describe, expect, it } from "vitest";
import { historialDiente } from "./historialDiente.js";
import type { ItemPlan, Odontograma } from "./types.js";

const odo = (estado?: "Caries" | "Obturación"): Odontograma =>
  estado ? { "16": { zonas: { oclusal: { estados: [estado], color: "#000", nota: "" } } } } : {};

describe("historialDiente", () => {
  it("registra cambios y tratamientos, omite atenciones sin novedad", () => {
    const plan = [
      { estado: "realizado", pieza: "16", tratamiento: "Resina", realizado: { visitId: "B" } },
    ] as unknown as ItemPlan[];
    const h = historialDiente(
      16,
      [
        { visitId: "C", fecha: "2026-03-01", dientes: odo("Obturación") },
        { visitId: "A", fecha: "2026-01-01", dientes: odo("Caries") },
        { visitId: "B", fecha: "2026-02-01", dientes: odo("Caries") },
      ],
      plan,
    );
    expect(h.map((e) => e.visitId)).toEqual(["A", "B", "C"]);
    expect(h[0].cambio).toBe("Sin registro → oclusal: Caries");
    expect(h[1].cambio).toBeNull();
    expect(h[1].tratamientos).toEqual(["Resina"]);
    expect(h[2].cambio).toBe("oclusal: Caries → oclusal: Obturación");
  });
  it("no emite nada si la pieza nunca tuvo registro", () => {
    expect(historialDiente(11, [{ visitId: "A", fecha: "2026-01-01", dientes: odo("Caries") }], [])).toEqual([]);
  });
});
