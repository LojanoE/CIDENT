import { describe, expect, it } from "vitest";
import { enlaceVigente, expiracionPortal, planSinMontos } from "./portal.js";
import { verPortalSchema } from "./schemas.js";

describe("enlaceVigente", () => {
  const ahora = new Date("2026-01-10T00:00:00Z");
  it("acepta uno activo y no vencido", () => {
    expect(enlaceVigente({ revocado: false, expiraAt: "2026-01-11T00:00:00Z" }, ahora)).toBe(true);
  });
  it("rechaza vencido", () => {
    expect(enlaceVigente({ revocado: false, expiraAt: "2026-01-09T00:00:00Z" }, ahora)).toBe(false);
  });
  it("rechaza revocado", () => {
    expect(enlaceVigente({ revocado: true, expiraAt: "2026-02-01T00:00:00Z" }, ahora)).toBe(false);
  });
  it("vence a los 30 días", () => {
    expect(expiracionPortal(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01-31T00:00:00.000Z");
  });
});

describe("planSinMontos", () => {
  it("no incluye ningún campo de dinero", () => {
    const plan = planSinMontos({
      fecha: "2026-01-01",
      estado: "pendiente",
      lineas: [
        { tratamiento: "Resina", pieza: "16", cantidad: 1, precioUnitario: 50, totalLinea: 50 },
        { tratamiento: "Limpieza", cantidad: 2, precioUnitario: 20, totalLinea: 40 },
      ],
    });
    expect(plan.tratamientos).toEqual([
      { tratamiento: "Resina", pieza: "16", cantidad: 1 },
      { tratamiento: "Limpieza", cantidad: 2 },
    ]);
    expect(JSON.stringify(plan)).not.toMatch(/precio|total|pagado|iva|descuento/i);
  });
});

describe("verPortalSchema", () => {
  it("exige 43 caracteres base64url", () => {
    expect(verPortalSchema.safeParse({ token: "a".repeat(43) }).success).toBe(true);
    expect(verPortalSchema.safeParse({ token: "a".repeat(42) }).success).toBe(false);
    expect(verPortalSchema.safeParse({ token: "a/".repeat(21) + "a" }).success).toBe(false);
  });
});
