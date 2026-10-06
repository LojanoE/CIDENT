import { describe, expect, it } from "vitest";
import { PLANTILLAS_CONSENTIMIENTO, armarConsentimiento, generarConsentimientoSchema } from "./consentimiento.js";

const datos = {
  paciente: "Pérez María",
  cedula: "0102030405",
  tratamiento: "Extracción",
  pieza: "38",
  profesional: "Dr. Ejemplo",
  centro: "Centro Demo",
};

describe("armarConsentimiento", () => {
  it("no deja variables sin reemplazar en ninguna plantilla", () => {
    for (const p of PLANTILLAS_CONSENTIMIENTO) expect(armarConsentimiento(p, datos)).not.toMatch(/\{\w+\}/);
  });
  it("incluye la pieza solo si existe", () => {
    expect(armarConsentimiento("general", datos)).toContain("Extracción, pieza 38");
    expect(armarConsentimiento("general", { ...datos, pieza: undefined })).not.toContain("pieza");
  });
});

describe("generarConsentimientoSchema", () => {
  const base = {
    patientId: "p",
    visitId: "v",
    plantilla: "general",
    tratamiento: "Limpieza",
    textoFinal: "Texto de consentimiento suficientemente largo.",
    firmaPaciente: "data:image/png;base64,iVBORw0KGgo=",
    firmante: { nombre: "María", cedula: "0102030405", relacion: "paciente" },
  };
  it("acepta una solicitud válida y pieza null", () => {
    expect(generarConsentimientoSchema.safeParse({ ...base, pieza: null }).success).toBe(true);
  });
  it("rechaza firma que no es PNG o es demasiado grande", () => {
    expect(generarConsentimientoSchema.safeParse({ ...base, firmaPaciente: "data:image/jpeg;base64,xx" }).success).toBe(false);
    expect(
      generarConsentimientoSchema.safeParse({ ...base, firmaPaciente: "data:image/png;base64," + "A".repeat(500_000) }).success,
    ).toBe(false);
  });
});
