import { createHash } from "node:crypto";
import forge from "node-forge";
import PDFDocument from "pdfkit";
import { beforeAll, describe, expect, it } from "vitest";
import { verificarVigencia } from "../src/firma/prepararFirma.js";
import { cifrar, descifrar } from "../src/lib/cifrado.js";
import {
  CertificadoInvalidoError,
  ContrasenaIncorrectaError,
  firmarPdf,
  leerP12,
} from "../src/lib/firmaElectronica.js";
import { crearSello, textoQr } from "../src/pdf/selloFirma.js";

const PASSWORD = "clave-de-prueba";
const DIA = 24 * 3600 * 1000;

/** .p12 autofirmado de prueba; así no hay certificados reales en el repo. */
function crearP12(opciones: { cn: string; desde: Date; hasta: Date }): Buffer {
  const llaves = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = llaves.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = opciones.desde;
  cert.validity.notAfter = opciones.hasta;
  const atributos = [{ name: "commonName", value: opciones.cn }];
  cert.setSubject(atributos);
  cert.setIssuer([{ name: "commonName", value: "CA de Prueba" }]);
  cert.sign(llaves.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(llaves.privateKey, [cert], PASSWORD, { algorithm: "3des" });
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary");
}

function crearPdf(): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
    const trozos: Buffer[] = [];
    doc.on("data", (c: Buffer) => trozos.push(c));
    doc.on("end", () => resolve(Buffer.concat(trozos)));
    doc.fontSize(14).text("Receta de prueba", 50, 60);
    doc.end();
  });
}

let p12Vigente: Buffer;
let p12Vencido: Buffer;

beforeAll(() => {
  const ahora = Date.now();
  p12Vigente = crearP12({ cn: "DOCTORA DE PRUEBA", desde: new Date(ahora - DIA), hasta: new Date(ahora + 365 * DIA) });
  p12Vencido = crearP12({ cn: "DOCTORA VENCIDA", desde: new Date(ahora - 400 * DIA), hasta: new Date(ahora - 30 * DIA) });
}, 60_000);

describe("leerP12", () => {
  it("lee titular, emisor y vigencia con la contraseña correcta", () => {
    const datos = leerP12(p12Vigente, PASSWORD);
    expect(datos.titular).toBe("DOCTORA DE PRUEBA");
    expect(datos.emisor).toBe("CA de Prueba");
    expect(new Date(datos.validoHasta).getTime()).toBeGreaterThan(Date.now());
  });

  it("rechaza una contraseña incorrecta", () => {
    expect(() => leerP12(p12Vigente, "otra")).toThrow(ContrasenaIncorrectaError);
  });

  it("rechaza un archivo que no es un .p12", () => {
    expect(() => leerP12(Buffer.from("no soy un p12"), PASSWORD)).toThrow(CertificadoInvalidoError);
  });
});

describe("verificarVigencia", () => {
  it("acepta un certificado vigente", () => {
    expect(() => verificarVigencia(leerP12(p12Vigente, PASSWORD))).not.toThrow();
  });

  it("rechaza un certificado vencido", () => {
    expect(() => verificarVigencia(leerP12(p12Vencido, PASSWORD))).toThrow(/vencida/);
  });
});

describe("firmarPdf", () => {
  it("produce una firma PKCS#7 válida sobre el contenido del PDF", async () => {
    const pdf = await crearPdf();
    const firmado = await firmarPdf(pdf, p12Vigente, PASSWORD, {
      nombre: "DOCTORA DE PRUEBA",
      motivo: "Documento clínico",
      ubicacion: "Centro de prueba",
    });

    const texto = firmado.toString("latin1");
    const rango = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(texto);
    expect(rango).not.toBeNull();
    const [a, b, c, d] = (rango as RegExpExecArray).slice(1).map(Number) as [number, number, number, number];
    const firmable = Buffer.concat([firmado.subarray(a, a + b), firmado.subarray(c, c + d)]);

    const hex = /\/Contents\s*<([0-9a-fA-F]+)>/.exec(texto)?.[1] ?? "";
    const der = Buffer.from(hex, "hex").toString("binary");
    const asn1 = forge.asn1.fromDer(der, { parseAllBytes: false } as never);
    const p7 = forge.pkcs7.messageFromAsn1(asn1) as unknown as {
      rawCapture: { authenticatedAttributes: forge.asn1.Asn1[]; signature: string; digestAlgorithm: string };
      certificates: forge.pki.Certificate[];
    };

    // 1) el digest firmado coincide con el contenido real del PDF
    const atributos = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, p7.rawCapture.authenticatedAttributes);
    const digestAtributo = p7.rawCapture.authenticatedAttributes
      .map((attr) => attr.value as forge.asn1.Asn1[])
      .find((v) => forge.asn1.derToOid(v[0]?.value as string) === forge.pki.oids["messageDigest"]);
    const digestFirmado = ((digestAtributo?.[1]?.value as forge.asn1.Asn1[])[0]?.value as string) ?? "";
    const digestReal = createHash("sha256").update(firmable).digest("binary");
    expect(Buffer.from(digestFirmado, "binary").equals(Buffer.from(digestReal, "binary"))).toBe(true);

    // 2) la firma RSA sobre los atributos verifica con la llave pública del certificado
    const md = forge.md.sha256.create();
    md.update(forge.asn1.toDer(atributos).getBytes());
    const cert = p7.certificates[0] as forge.pki.Certificate;
    const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
    expect(publicKey.verify(md.digest().getBytes(), p7.rawCapture.signature)).toBe(true);
  }, 60_000);

  it("no firma con una contraseña incorrecta", async () => {
    const pdf = await crearPdf();
    await expect(
      firmarPdf(pdf, p12Vigente, "otra", { nombre: "X", motivo: "m", ubicacion: "u" }),
    ).rejects.toThrow();
  });
});

describe("cifrado del certificado", () => {
  const datos = Buffer.from("contenido del p12");

  it("descifra lo que cifró con la misma clave y contexto", () => {
    expect(descifrar(cifrar(datos, "kek", "uid-1"), "kek", "uid-1").equals(datos)).toBe(true);
  });

  it("falla con otra clave", () => {
    expect(() => descifrar(cifrar(datos, "kek", "uid-1"), "otra", "uid-1")).toThrow();
  });

  it("falla si se copia a otro usuario (el uid se autentica)", () => {
    expect(() => descifrar(cifrar(datos, "kek", "uid-1"), "kek", "uid-2")).toThrow();
  });

  it("falla si se altera el archivo", () => {
    const cifrado = cifrar(datos, "kek", "uid-1");
    cifrado[cifrado.length - 1] = (cifrado[cifrado.length - 1] ?? 0) ^ 0xff;
    expect(() => descifrar(cifrado, "kek", "uid-1")).toThrow();
  });

  it("no deja el contenido en claro dentro del archivo", () => {
    expect(cifrar(datos, "kek", "uid-1").includes(datos)).toBe(false);
  });
});

describe("sello de firma", () => {
  it("el texto del QR nombra al firmante y dónde validar", () => {
    const texto = textoQr({ titular: "DOCTORA", centro: "Centro A", fecha: new Date("2026-10-16T19:32:00Z") });
    expect(texto).toContain("FIRMADO POR: DOCTORA");
    expect(texto).toContain("LOCALIZACION: Centro A");
    expect(texto).toContain("www.firmadigital.gob.ec");
  });

  it("genera un PNG para el QR", async () => {
    const sello = await crearSello({ titular: "DOCTORA", centro: "Centro A", fecha: new Date() });
    expect(sello.qrPng.subarray(0, 4).toString("hex")).toBe("89504e47");
    expect(sello.titular).toBe("DOCTORA");
  });
});
