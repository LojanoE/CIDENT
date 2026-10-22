import { verCitaPublicaSchema } from "@cident/shared";
import { describe, expect, it } from "vitest";
import { firmarCita, verificarTokenCita } from "../src/lib/enlaceCita";

const ID = "AbCdEfGhIjKlMnOpQrSt";
const CLAVE = "clave-de-prueba";

describe("token de confirmación de cita", () => {
  it("round-trip válido y cumple el schema público", () => {
    const token = firmarCita(ID, CLAVE);
    expect(verCitaPublicaSchema.safeParse({ token }).success).toBe(true);
    expect(verificarTokenCita(token, CLAVE)).toBe(ID);
  });

  it("rechaza otra clave, un id alterado y basura", () => {
    const token = firmarCita(ID, CLAVE);
    expect(verificarTokenCita(token, "otra-clave")).toBeNull();
    expect(verificarTokenCita(token.replace(ID, "ZZZZZZZZZZZZZZZZZZZZ"), CLAVE)).toBeNull();
    expect(verificarTokenCita("sin-punto", CLAVE)).toBeNull();
    expect(verificarTokenCita(`${ID}.corta`, CLAVE)).toBeNull();
  });
});
