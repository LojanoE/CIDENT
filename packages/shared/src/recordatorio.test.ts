import { describe, expect, it } from "vitest";
import { PLANTILLA_RECORDATORIO_DEFECTO, armarRecordatorio, fechaLargaDe } from "./recordatorio.js";

const datos = {
  paciente: "María Pérez",
  inicio: "2026-10-07T15:30",
  profesional: "Dr. Ejemplo",
  centro: "Centro Demo",
  direccion: "Av. Principal 123",
  telefono: "0991234567",
};

describe("fechaLargaDe", () => {
  it("escribe día de la semana, día y mes en español", () => {
    expect(fechaLargaDe("2026-10-07T15:30")).toBe("miércoles 7 de octubre");
    expect(fechaLargaDe("2026-01-01T08:00")).toBe("jueves 1 de enero");
  });
});

describe("armarRecordatorio", () => {
  it("reemplaza todas las variables", () => {
    const texto = armarRecordatorio(
      "{paciente}|{fecha}|{hora}|{profesional}|{centro}|{direccion}|{telefono}",
      datos,
    );
    expect(texto).toBe("María Pérez|miércoles 7 de octubre|15:30|Dr. Ejemplo|Centro Demo|Av. Principal 123|0991234567");
  });

  it("repite una variable usada varias veces", () => {
    expect(armarRecordatorio("{hora} y otra vez {hora}", datos)).toBe("15:30 y otra vez 15:30");
  });

  it("deja tal cual una variable desconocida", () => {
    expect(armarRecordatorio("Hola {paciente} {inventada}", datos)).toBe("Hola María Pérez {inventada}");
  });

  it("usa la plantilla por defecto si está vacía o ausente", () => {
    const esperado = armarRecordatorio(PLANTILLA_RECORDATORIO_DEFECTO, datos);
    expect(armarRecordatorio(undefined, datos)).toBe(esperado);
    expect(armarRecordatorio("   ", datos)).toBe(esperado);
    expect(esperado).not.toContain("{");
  });

  it("deja vacías la dirección y el teléfono si no hay", () => {
    expect(armarRecordatorio("[{direccion}][{telefono}]", { ...datos, direccion: undefined, telefono: undefined })).toBe(
      "[][]",
    );
  });
});
