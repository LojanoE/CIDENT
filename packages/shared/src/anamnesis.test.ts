import { describe, expect, it } from "vitest";
import { alertasAnamnesis, anamnesisSchema, anamnesisVacia } from "./anamnesis.js";

describe("alertasAnamnesis", () => {
  it("sin ficha ni alergias no hay alertas", () => {
    expect(alertasAnamnesis(undefined, "")).toEqual([]);
    expect(alertasAnamnesis(anamnesisVacia(), "  ")).toEqual([]);
  });

  it("pone primero las altas y luego las medias", () => {
    const a = { ...anamnesisVacia(), diabetes: true, anticoagulantes: true, medicacion: "Warfarina" };
    const r = alertasAnamnesis(a, "Látex");
    expect(r.map((x) => x.nivel)).toEqual(["alta", "alta", "media", "media"]);
    expect(r[0]?.texto).toBe("Alergias: Látex");
    expect(r.at(-1)?.texto).toBe("Medicación: Warfarina");
  });

  it("fumador y bruxismo no generan alerta", () => {
    expect(alertasAnamnesis({ ...anamnesisVacia(), fumador: true, bruxismo: true })).toEqual([]);
  });
});

describe("anamnesisSchema", () => {
  it("tolera null (callable) y campos ausentes", () => {
    const r = anamnesisSchema.parse({ diabetes: null, medicacion: null });
    expect(r.diabetes).toBe(false);
    expect(r.medicacion).toBe("");
  });
});
