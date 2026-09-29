import { LOGO_MAX_BYTES } from "@cident/shared";

/**
 * Validación de las imágenes que suben los administradores como logo del centro.
 *
 * Es deliberadamente una función pura (sin Firestore ni Storage) para poder
 * testearla sin emuladores, y valida por la firma binaria del archivo en vez de
 * confiar en el `mimeType` que declara el cliente: un archivo que no sea una
 * imagen real haría lanzar a pdfkit al generar el PDF, y el `try/catch` del
 * encabezado lo absorbería dejando el documento sin logo y sin explicación.
 */

export type ResultadoLogo =
  | { ok: true; extension: "png" | "jpg"; mimeType: "image/png" | "image/jpeg" }
  | { ok: false; motivo: string };

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const FIRMA_JPEG = [0xff, 0xd8, 0xff];

function empiezaCon(buffer: Buffer, firma: number[]): boolean {
  if (buffer.length < firma.length) return false;
  return firma.every((byte, i) => buffer[i] === byte);
}

export function validarImagenLogo(buffer: Buffer, mimeTypeDeclarado: string): ResultadoLogo {
  if (buffer.length === 0) {
    return { ok: false, motivo: "El archivo está vacío." };
  }
  if (buffer.length > LOGO_MAX_BYTES) {
    return { ok: false, motivo: "La imagen supera 1 MB." };
  }

  if (empiezaCon(buffer, FIRMA_PNG)) {
    if (mimeTypeDeclarado !== "image/png") {
      return { ok: false, motivo: "El archivo es un PNG pero se declaró como otro tipo." };
    }
    return { ok: true, extension: "png", mimeType: "image/png" };
  }

  if (empiezaCon(buffer, FIRMA_JPEG)) {
    if (mimeTypeDeclarado !== "image/jpeg") {
      return { ok: false, motivo: "El archivo es un JPEG pero se declaró como otro tipo." };
    }
    return { ok: true, extension: "jpg", mimeType: "image/jpeg" };
  }

  return { ok: false, motivo: "El archivo no es una imagen PNG ni JPEG." };
}
