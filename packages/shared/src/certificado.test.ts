import { describe, expect, it } from "vitest";
import { fechaLarga, formatearCompromiso, textoCertificado } from "./certificado.js";

const paciente = { nombres: "Carlos Mesías", apellidos: "Casco Ortiz", cedula: "2100678982" };

describe("fechaLarga", () => {
  it("escribe la fecha en español", () => {
    expect(fechaLarga("2026-10-16")).toBe("16 de octubre de 2026");
    expect(fechaLarga("2026-01-05")).toBe("5 de enero de 2026");
  });
  it("deja intacto lo que no es una fecha ISO", () => {
    expect(fechaLarga("ayer")).toBe("ayer");
  });
});

describe("formatearCompromiso", () => {
  it("agrega el % a un número", () => {
    expect(formatearCompromiso("30")).toBe("30 %");
    expect(formatearCompromiso("30%")).toBe("30 %");
  });
  it("respeta el texto libre", () => {
    expect(formatearCompromiso("parcial")).toBe("parcial");
  });
});

describe("textoCertificado", () => {
  it("redacta el certificado completo", () => {
    const t = textoCertificado({
      paciente,
      fechaAtencion: "2026-10-01",
      diagnosticoCie10: "K02.1",
      compromiso: "30",
      piezas: "1.6",
      procedimiento: "una resina",
      recomendacion: "control en 6 meses.",
    });
    expect(t.cuerpo[0]).toBe(
      "Por medio del presente certifico haber atendido a Carlos Mesías Casco Ortiz, con cédula de identidad 2100678982, " +
        "el día 1 de octubre de 2026, por el servicio de Consulta odontológica externa con un diagnóstico CIE-10 K02.1, " +
        "el 30 % de compromiso de la pieza dental 1.6.",
    );
    expect(t.cuerpo[1]).toBe("Se procedió a realizar una resina.");
    expect(t.cuerpo[2]).toBe("Se recomienda control en 6 meses.");
    expect(t.cierre).toContain("fines pertinentes");
  });

  it("pone la descripción del CIE-10 entre paréntesis", () => {
    const t = textoCertificado({ paciente, fechaAtencion: "2026-10-01", diagnosticoCie10: "K02.1 Caries de la dentina" });
    expect(t.cuerpo[0]).toMatch(/diagnóstico CIE-10 K02\.1 \(Caries de la dentina\)\.$/);
  });

  it("omite las frases sin datos, sin dejar huecos", () => {
    const t = textoCertificado({ paciente, fechaAtencion: "2026-10-01" });
    expect(t.cuerpo).toHaveLength(1);
    expect(t.cuerpo[0]).toMatch(/Consulta odontológica externa\.$/);
    expect(t.cuerpo[0]).not.toMatch(/compromiso|diagnóstico/);
  });

  it("solo pieza: no inventa porcentaje", () => {
    const t = textoCertificado({ paciente, fechaAtencion: "2026-10-01", piezas: "2.5" });
    expect(t.cuerpo[0]).toMatch(/externa con compromiso de la pieza dental 2\.5\.$/);
  });

  it("conserva motivo y observaciones de certificados anteriores", () => {
    const t = textoCertificado({ paciente, fechaAtencion: "2026-10-01", motivo: "dolor", observaciones: "reposo" });
    expect(t.cuerpo).toContain("Motivo: dolor.");
    expect(t.cuerpo).toContain("Observaciones: reposo.");
  });
});
