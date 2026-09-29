import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calcularEdad } from "./edad.js";

describe("calcularEdad", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Hora local (no Date.UTC): calcularEdad lee componentes locales de
    // `new Date()`, así que anclar el reloj falso en UTC podría desplazar
    // "hoy" un día en husos horarios negativos (p. ej. Ecuador, UTC-5).
    vi.setSystemTime(new Date(2026, 8, 28, 12)); // 2026-09-28 12:00 local, coincide con la fecha del entorno
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve null si no hay fecha", () => {
    expect(calcularEdad(undefined)).toBeNull();
    expect(calcularEdad(null)).toBeNull();
    expect(calcularEdad("")).toBeNull();
  });

  it("devuelve null con formato inválido", () => {
    expect(calcularEdad("28/09/2000")).toBeNull();
    expect(calcularEdad("no-es-fecha")).toBeNull();
  });

  it("calcula años y meses cuando ya pasó el cumpleaños este año", () => {
    // Nacido 1990-01-15; hoy 2026-09-28 → 36 años, 8 meses
    expect(calcularEdad("1990-01-15")).toEqual({ anios: 36, meses: 8 });
  });

  it("resta un año si el cumpleaños de este año aún no llegó", () => {
    // Nacido 1990-12-01; hoy 2026-09-28 → todavía no cumple en 2026 → 35 años
    const edad = calcularEdad("1990-12-01");
    expect(edad?.anios).toBe(35);
  });

  it("calcula correctamente el día exacto del cumpleaños", () => {
    // Nacido 2000-09-28; hoy 2026-09-28 → cumple hoy → 26 años, 0 meses
    expect(calcularEdad("2000-09-28")).toEqual({ anios: 26, meses: 0 });
  });

  it("maneja bebés (menos de un año)", () => {
    expect(calcularEdad("2026-06-15")).toEqual({ anios: 0, meses: 3 });
  });
});
