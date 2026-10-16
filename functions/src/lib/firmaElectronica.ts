import { P12Signer } from "@signpdf/signer-p12";
import { plainAddPlaceholder } from "@signpdf/placeholder-plain";
import { SignPdf } from "@signpdf/signpdf";
import forge from "node-forge";

/** Datos públicos del certificado del profesional (nada secreto). */
export interface DatosCertificado {
  titular: string;
  emisor: string;
  validoDesde: string; // ISO
  validoHasta: string; // ISO
}

/** La contraseña no abre el .p12 (o el archivo no es un PKCS#12 válido). */
export class ContrasenaIncorrectaError extends Error {
  constructor() {
    super("Contraseña incorrecta.");
  }
}

export class CertificadoInvalidoError extends Error {}

function nombreComun(campos: forge.pki.CertificateField[], respaldo: string): string {
  const cn = campos.find((c) => c.shortName === "CN" || c.name === "commonName");
  return typeof cn?.value === "string" && cn.value.trim() ? cn.value.trim() : respaldo;
}

/**
 * Abre el .p12 y devuelve los datos del certificado del titular (el que
 * corresponde a la clave privada, no los de la cadena de la CA).
 */
export function leerP12(p12: Buffer, password: string): DatosCertificado {
  let archivo: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12.toString("binary")));
    archivo = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "";
    // forge no distingue "contraseña mala" de "MAC inválido"; ambos se reportan igual.
    if (/password|MAC/i.test(mensaje)) throw new ContrasenaIncorrectaError();
    throw new CertificadoInvalidoError("El archivo no es un certificado .p12 válido.");
  }

  const oidClave = forge.pki.oids["pkcs8ShroudedKeyBag"] as string;
  const oidCert = forge.pki.oids["certBag"] as string;
  const claves: forge.pkcs12.Bag[] = archivo.getBags({ bagType: oidClave })[oidClave] ?? [];
  const certificados: forge.pkcs12.Bag[] = archivo.getBags({ bagType: oidCert })[oidCert] ?? [];
  if (certificados.length === 0) {
    throw new CertificadoInvalidoError("El .p12 no contiene ningún certificado.");
  }

  // El certificado del titular comparte `localKeyId` con la clave; si no hay, se toma el primero.
  const idClave = claves[0]?.attributes?.localKeyId?.[0];
  const bag =
    certificados.find((c: forge.pkcs12.Bag) => idClave !== undefined && c.attributes?.localKeyId?.[0] === idClave) ?? certificados[0];
  const cert = bag?.cert;
  if (!cert) {
    throw new CertificadoInvalidoError("No se pudo leer el certificado del .p12.");
  }

  return {
    titular: nombreComun(cert.subject.attributes, "Titular desconocido"),
    emisor: nombreComun(cert.issuer.attributes, "Emisor desconocido"),
    validoDesde: cert.validity.notBefore.toISOString(),
    validoHasta: cert.validity.notAfter.toISOString(),
  };
}

export interface OpcionesFirmaPdf {
  nombre: string;
  motivo: string;
  ubicacion: string;
  contacto?: string;
}

/**
 * Firma digitalmente (PAdES/PKCS#7 detached) un PDF ya generado. Hay que firmar
 * lo último: cualquier cambio posterior al PDF invalida la firma.
 */
export async function firmarPdf(
  pdf: Buffer,
  p12: Buffer,
  password: string,
  opciones: OpcionesFirmaPdf,
): Promise<Buffer> {
  const conMarcador = plainAddPlaceholder({
    pdfBuffer: pdf,
    reason: opciones.motivo,
    contactInfo: opciones.contacto ?? "-",
    name: opciones.nombre,
    location: opciones.ubicacion,
    // Las cadenas de certificados de las CA ecuatorianas pesan varios KB: se deja margen.
    signatureLength: 16384,
  });
  const signer = new P12Signer(p12, { passphrase: password });
  return new SignPdf().sign(conMarcador, signer);
}
