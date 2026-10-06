import type { Centro, Paciente } from "@cident/shared";
import {
  PAGE_MARGIN_X,
  asegurarEspacio,
  bloqueTexto,
  cm,
  crearDocumento,
  dibujarEncabezado,
  dibujarPie,
  type ProfesionalPdf,
} from "./layout.js";

export interface DatosConsentimientoPdf {
  centro: Centro;
  profesional: ProfesionalPdf;
  paciente: Paciente;
  consentimiento: {
    fecha: string;
    /** Fecha y hora ISO del momento de la firma. */
    firmadoAt: string;
    titulo: string;
    texto: string;
    codigoUnico: string;
    hashTexto: string;
    firmante: { nombre: string; cedula: string; relacion: "paciente" | "representante" };
  };
  firmaPaciente: Buffer;
  firma: Buffer | null;
  logo: Buffer | null;
}

export function generarPdfConsentimiento(datos: DatosConsentimientoPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = crearDocumento();
    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const { consentimiento: c } = datos;
    const anchoUtil = doc.page.width - 2 * PAGE_MARGIN_X;
    let y = dibujarEncabezado(doc, "CONSENTIMIENTO INFORMADO", datos.logo);

    doc
      .fontSize(10)
      .fillColor("#333333")
      .font("Regular")
      .text(`Código: ${c.codigoUnico}`, PAGE_MARGIN_X, y, { continued: true })
      .text(`   Fecha: ${c.fecha}`);
    y = doc.y + cm(0.3);

    y = bloqueTexto(
      doc,
      PAGE_MARGIN_X,
      y,
      anchoUtil,
      "PACIENTE",
      `${datos.paciente.apellidos} ${datos.paciente.nombres}  —  Cédula: ${datos.paciente.cedula}`,
    );

    y = asegurarEspacio(doc, y, cm(6));
    y = bloqueTexto(doc, PAGE_MARGIN_X, y, anchoUtil, c.titulo.toUpperCase(), c.texto);

    // Constancia del texto firmado y bloque de firma del paciente (lado derecho; la del profesional va en el pie).
    y = asegurarEspacio(doc, y, cm(6));
    doc
      .fillColor("#666666")
      .font("Regular")
      .fontSize(7)
      .text(`Huella SHA-256 del texto firmado: ${c.hashTexto}`, PAGE_MARGIN_X, y, { width: anchoUtil });
    y = doc.y + cm(0.3);

    const anchoFirma = cm(6);
    const xFirma = doc.page.width - PAGE_MARGIN_X - anchoFirma;
    try {
      doc.image(datos.firmaPaciente, xFirma, y, { fit: [anchoFirma, cm(2)], align: "center", valign: "bottom" });
    } catch {
      // Una firma ilegible ya se rechazó en la callable; si pdfkit falla igual, se deja el espacio en blanco.
    }
    const yLinea = y + cm(2.1);
    doc.moveTo(xFirma, yLinea).lineTo(xFirma + anchoFirma, yLinea).lineWidth(0.7).strokeColor("#333333").stroke();
    const rol = c.firmante.relacion === "representante" ? "Representante legal" : "Paciente";
    doc
      .fillColor("#333333")
      .font("Bold")
      .fontSize(9)
      .text(c.firmante.nombre, xFirma, yLinea + cm(0.1), { width: anchoFirma, align: "center" })
      .font("Regular")
      .fontSize(8)
      .text(`${rol} — Cédula: ${c.firmante.cedula}`, xFirma, doc.y, { width: anchoFirma, align: "center" })
      .text(`Firmado: ${c.firmadoAt.slice(0, 10)} ${c.firmadoAt.slice(11, 16)} UTC`, xFirma, doc.y, {
        width: anchoFirma,
        align: "center",
      });

    dibujarPie(doc, datos.centro, datos.profesional, datos.firma);

    doc.end();
  });
}
