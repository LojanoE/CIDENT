import type { FirmaDocumento } from "@cident/shared";
import { HttpsError } from "firebase-functions/v2/https";
import { descifrar, FIRMA_KEK } from "../lib/cifrado.js";
import {
  CertificadoInvalidoError,
  ContrasenaIncorrectaError,
  firmarPdf,
  leerP12,
  type DatosCertificado,
} from "../lib/firmaElectronica.js";
import { limpiarFallosFirma, registrarFalloFirma, verificarLimiteFirma } from "../lib/rateLimit.js";
import { descargarOpcional, obtenerFirmaBuffer, rutaCertificado } from "../pdf/firma.js";
import { crearSello, type SelloFirma } from "../pdf/selloFirma.js";

export interface FirmaPreparada {
  /** Imagen de la firma dibujada/escaneada; `null` si se firma electrónicamente o no hay. */
  firma: Buffer | null;
  /** Sello visible (QR + titular) cuando el documento se firma electrónicamente. */
  sello: SelloFirma | null;
  /** Cómo quedó firmado; se guarda en el documento emitido. */
  info: FirmaDocumento;
  /** Aplica la firma digital al PDF ya generado (identidad si no hay firma electrónica). */
  firmar: (pdf: Buffer) => Promise<Buffer>;
}

export interface ParametrosFirma {
  uid: string;
  /** Nombre del centro: va en el QR y como ubicación de la firma. */
  centro: string;
  /** Contraseña del .p12; ausente = firma dibujada. Se usa y se descarta, jamás se guarda. */
  password?: string | undefined;
}

/** Valida que el certificado esté vigente; un certificado vencido no puede firmar. */
export function verificarVigencia(datos: DatosCertificado, ahora = new Date()): void {
  if (new Date(datos.validoHasta) < ahora) {
    throw new HttpsError("failed-precondition", "Tu firma electrónica está vencida. Renuévala para poder firmar con ella.");
  }
  if (new Date(datos.validoDesde) > ahora) {
    throw new HttpsError("failed-precondition", "Tu firma electrónica todavía no está vigente.");
  }
}

/**
 * Traduce los errores de lectura del .p12 a errores de la callable. Una contraseña
 * incorrecta se cuenta como intento fallido (freno a la fuerza bruta).
 */
export async function abrirP12(p12: Buffer, password: string, uid: string): Promise<DatosCertificado> {
  try {
    return leerP12(p12, password);
  } catch (err) {
    if (err instanceof ContrasenaIncorrectaError) {
      await registrarFalloFirma(uid);
      throw new HttpsError("invalid-argument", "La contraseña de la firma es incorrecta.", {
        motivo: "contrasena_incorrecta",
      });
    }
    if (err instanceof CertificadoInvalidoError) {
      throw new HttpsError("invalid-argument", err.message);
    }
    throw err;
  }
}

/**
 * Punto único de firma de los documentos. Con contraseña firma electrónicamente
 * (PAdES con el .p12 guardado del usuario); sin ella usa la firma dibujada.
 * Debe llamarse ANTES de crear el documento en Firestore: así una contraseña
 * incorrecta no deja registros a medias.
 */
export async function prepararFirma({ uid, centro, password }: ParametrosFirma): Promise<FirmaPreparada> {
  if (!password) {
    const firma = await obtenerFirmaBuffer(uid);
    return {
      firma,
      sello: null,
      info: { tipo: firma ? "manuscrita" : "ninguna" },
      firmar: async (pdf) => pdf,
    };
  }

  await verificarLimiteFirma(uid);

  const cifrado = await descargarOpcional(rutaCertificado(uid));
  if (!cifrado) {
    throw new HttpsError(
      "failed-precondition",
      "No tienes una firma electrónica guardada. Súbela en «Mi firma» o firma con tu firma dibujada.",
    );
  }

  let p12: Buffer;
  try {
    p12 = descifrar(cifrado, FIRMA_KEK.value(), uid);
  } catch {
    throw new HttpsError("internal", "No se pudo abrir tu firma electrónica guardada. Vuelve a subirla en «Mi firma».");
  }

  const datos = await abrirP12(p12, password, uid);
  verificarVigencia(datos);
  await limpiarFallosFirma(uid);

  const sello = await crearSello({ titular: datos.titular, centro, fecha: new Date() });
  return {
    firma: null,
    sello,
    info: { tipo: "electronica", titular: datos.titular },
    firmar: (pdf) => firmarPdf(pdf, p12, password, { nombre: datos.titular, motivo: "Documento clínico", ubicacion: centro }),
  };
}
