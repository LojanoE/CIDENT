import QRCode from "qrcode";

/** Sello visible de una firma electrónica: QR + nombre del titular (estilo FirmaEC). */
export interface SelloFirma {
  qrPng: Buffer;
  titular: string;
}

export interface DatosSello {
  titular: string;
  centro: string;
  fecha: Date;
}

/** Fecha legible en la zona horaria de Ecuador, p. ej. «16/10/2026 14:32». */
export function fechaEcuador(fecha: Date): string {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(fecha)
    .replace(",", "");
}

/**
 * El QR es informativo (la validez legal está en la firma PAdES incrustada).
 * Lleva el mismo tipo de datos que el de FirmaEC.
 */
export function textoQr({ titular, centro, fecha }: DatosSello): string {
  return [
    `FIRMADO POR: ${titular}`,
    "RAZON: Documento clínico",
    `LOCALIZACION: ${centro}`,
    `FECHA: ${fecha.toISOString()}`,
    "VALIDAR CON: www.firmadigital.gob.ec",
  ].join("\n");
}

export async function crearSello(datos: DatosSello): Promise<SelloFirma> {
  const qrPng = await QRCode.toBuffer(textoQr(datos), {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });
  return { qrPng, titular: datos.titular };
}
