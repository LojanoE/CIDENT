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

export interface DatosCertificado {
  centro: Centro;
  profesional: ProfesionalPdf;
  paciente: Paciente;
  certificado: {
    fecha: string;
    motivo: string;
    observaciones: string;
    codigoUnico: string;
  };
  firma: Buffer | null;
  logo: Buffer | null;
}

export function generarPdfCertificado(datos: DatosCertificado): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = crearDocumento();
    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const anchoUtil = doc.page.width - 2 * PAGE_MARGIN_X;
    let y = dibujarEncabezado(doc, "CERTIFICADO ODONTOLÓGICO", datos.logo);

    doc
      .fontSize(10)
      .fillColor("#333333")
      .font("Regular")
      .text(`Código: ${datos.certificado.codigoUnico}`, PAGE_MARGIN_X, y, { continued: true })
      .text(`   Fecha: ${datos.certificado.fecha}`);
    y = doc.y + cm(0.3);

    y = bloqueTexto(
      doc,
      PAGE_MARGIN_X,
      y,
      anchoUtil,
      "PACIENTE",
      `${datos.paciente.apellidos} ${datos.paciente.nombres}  —  Cédula: ${datos.paciente.cedula}`,
    );

    y = asegurarEspacio(doc, y, cm(3));
    y = bloqueTexto(doc, PAGE_MARGIN_X, y, anchoUtil, "MOTIVO", datos.certificado.motivo);

    if (datos.certificado.observaciones) {
      y = asegurarEspacio(doc, y, cm(3));
      bloqueTexto(doc, PAGE_MARGIN_X, y, anchoUtil, "OBSERVACIONES", datos.certificado.observaciones);
    }

    dibujarPie(doc, datos.centro, datos.profesional, datos.firma);

    doc.end();
  });
}
