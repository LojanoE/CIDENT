import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { defineSecret } from "firebase-functions/params";

/** Clave maestra (Secret Manager) con la que se cifran los certificados de firma en reposo. */
export const FIRMA_KEK = defineSecret("FIRMA_KEK");

const LONG_IV = 12;
const LONG_TAG = 16;

/** Cualquier texto del secreto sirve: se deriva una clave AES-256 con SHA-256. */
function derivarClave(kek: string): Buffer {
  return createHash("sha256").update(kek, "utf8").digest();
}

/**
 * AES-256-GCM. El resultado es `iv | tag | cifrado`. `contexto` (p. ej. el uid)
 * se autentica como AAD: un archivo cifrado de un usuario no se puede copiar
 * al de otro y que descifre.
 */
export function cifrar(datos: Buffer, kek: string, contexto: string): Buffer {
  const iv = randomBytes(LONG_IV);
  const cipher = createCipheriv("aes-256-gcm", derivarClave(kek), iv);
  cipher.setAAD(Buffer.from(contexto, "utf8"));
  const cifrado = Buffer.concat([cipher.update(datos), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), cifrado]);
}

/** Lanza si la clave, el contexto o los datos no coinciden (GCM autentica). */
export function descifrar(datos: Buffer, kek: string, contexto: string): Buffer {
  if (datos.length < LONG_IV + LONG_TAG) {
    throw new Error("Datos cifrados inválidos.");
  }
  const iv = datos.subarray(0, LONG_IV);
  const tag = datos.subarray(LONG_IV, LONG_IV + LONG_TAG);
  const cifrado = datos.subarray(LONG_IV + LONG_TAG);
  const decipher = createDecipheriv("aes-256-gcm", derivarClave(kek), iv);
  decipher.setAAD(Buffer.from(contexto, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]);
}
