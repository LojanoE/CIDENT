import { describe, expect, it } from "vitest";
import { calcularIndicadores, mesAnterior, mesSiguiente, variacion } from "./indicadores.js";

describe("calcularIndicadores", () => {
  it("calcula inasistencia, aceptación y rankings", () => {
    const r = calcularIndicadores({
      citas: [{ estado: "atendida" }, { estado: "atendida" }, { estado: "atendida" }, { estado: "ausente" }, { estado: "cancelada" }],
      pacientesNuevos: 4,
      atenciones: [{ finalizedBy: "a" }, { finalizedBy: "a" }, { finalizedBy: "b" }],
      tratamientos: [
        { tratamiento: "Limpieza", uid: "a" },
        { tratamiento: "limpieza ", uid: "b" },
        { tratamiento: "Resina", uid: "a" },
      ],
      presupuestos: [{ estado: "aceptado" }, { estado: "rechazado" }, { estado: "pendiente" }],
    });
    expect(r.inasistencia).toBe(25);
    expect(r.citasCerradas).toBe(4);
    expect(r.atencionesPorProfesional[0]).toEqual({ uid: "a", total: 2 });
    expect(r.topTratamientos[0]).toEqual({ tratamiento: "limpieza", total: 2 });
    expect(r.aceptacion).toBe(50);
    expect(r.presupuestosResueltos).toBe(2);
  });

  it("devuelve null sin datos", () => {
    const r = calcularIndicadores({ citas: [], pacientesNuevos: 0, atenciones: [], tratamientos: [], presupuestos: [] });
    expect(r.inasistencia).toBeNull();
    expect(r.aceptacion).toBeNull();
  });
});

describe("meses", () => {
  it("cruza el año", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesSiguiente("2025-12")).toBe("2026-01");
    expect(mesAnterior("2026-10")).toBe("2026-09");
  });
  it("variacion", () => {
    expect(variacion(30, 20)).toBe(10);
    expect(variacion(null, 20)).toBeNull();
  });
});
