import { describe, expect, it } from "vitest";
import { validarImagenLogo } from "../src/lib/imagen.js";

const PNG_MINIMO = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
const JPEG_MINIMO = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00]);

describe("validarImagenLogo", () => {
  it("acepta un PNG válido declarado como image/png", () => {
    const resultado = validarImagenLogo(PNG_MINIMO, "image/png");
    expect(resultado).toEqual({ ok: true, extension: "png", mimeType: "image/png" });
  });

  it("acepta un JPEG válido declarado como image/jpeg", () => {
    const resultado = validarImagenLogo(JPEG_MINIMO, "image/jpeg");
    expect(resultado).toEqual({ ok: true, extension: "jpg", mimeType: "image/jpeg" });
  });

  it("rechaza un buffer que no es una imagen PNG ni JPEG", () => {
    const resultado = validarImagenLogo(Buffer.from("esto es texto plano, no una imagen"), "image/png");
    expect(resultado.ok).toBe(false);
  });

  it("rechaza un PNG declarado como image/jpeg", () => {
    const resultado = validarImagenLogo(PNG_MINIMO, "image/jpeg");
    expect(resultado.ok).toBe(false);
  });

  it("rechaza un buffer que supera el tamaño máximo", () => {
    const grande = Buffer.concat([PNG_MINIMO, Buffer.alloc(2 * 1024 * 1024)]);
    const resultado = validarImagenLogo(grande, "image/png");
    expect(resultado.ok).toBe(false);
  });

  it("rechaza un buffer vacío", () => {
    const resultado = validarImagenLogo(Buffer.alloc(0), "image/png");
    expect(resultado.ok).toBe(false);
  });
});
