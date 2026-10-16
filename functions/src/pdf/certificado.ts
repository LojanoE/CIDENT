import { fechaLarga, textoCertificado, type Centro, type Paciente } from "@cident/shared";
import { PAGE_MARGIN_X, cm, crearDocumento, dibujarSello, type ProfesionalPdf } from "./layout.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SelloFirma } from "./selloFirma.js";

const AZUL = "#1a3a5c";
const AZUL_CENTRO = "#4470c4";
const GRIS = "#666666";
const TEXTO = "#222222";
const ASSETS_DIR = join(dirname(fileURLToPath(import.meta.url)), "assets");

export interface DatosCertificado {
  centro: Centro;
  profesional: ProfesionalPdf;
  paciente: Paciente;
  certificado: {
    /** Fecha de la atención (ISO). */
    fecha: string;
    /** Fecha de emisión (ISO), la del encabezado «Ciudad, fecha». */
    fechaEmision: string;
    diagnosticoCie10?: string;
    compromiso?: string;
    piezas?: string;
    procedimiento?: string;
    recomendacion?: string;
    /** Certificados anteriores a la plantilla en prosa. */
    motivo?: string;
    observaciones?: string;
    codigoUnico: string;
  };
  firma: Buffer | null;
  sello?: SelloFirma | null;
  logo: Buffer | null;
}

/**
 * Certificado médico como carta: encabezado del centro, «Ciudad, fecha», título,
 * cuerpo justificado en serif, «Atentamente», firma, nombre y cargo, y pie con
 * dirección y teléfono. Sigue la plantilla en Word que usan los centros.
 */
export function generarPdfCertificado(datos: DatosCertificado): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = crearDocumento();
    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const ancho = doc.page.width;
    const anchoUtil = ancho - 2 * PAGE_MARGIN_X;
    const { centro, profesional, certificado } = datos;

    // Encabezado: logo a la izquierda y nombre del centro centrado.
    try {
      doc.image(datos.logo ?? join(ASSETS_DIR, "luna-dental.png"), PAGE_MARGIN_X, cm(1.4), {
        fit: [cm(2.4), cm(2.2)],
      });
    } catch {
      // El logo es decorativo: sin él el PDF se genera igual.
    }
    doc
      .font("Times-Bold")
      .fontSize(22)
      .fillColor(AZUL_CENTRO)
      .text(centro.nombre, PAGE_MARGIN_X, cm(1.8), { width: anchoUtil, align: "center", underline: true });
    doc
      .font("Times-Roman")
      .fontSize(13)
      .fillColor(GRIS)
      .text("Odontología integral", PAGE_MARGIN_X, doc.y + cm(0.1), { width: anchoUtil, align: "center" });
    doc
      .moveTo(PAGE_MARGIN_X, cm(4.1))
      .lineTo(ancho - PAGE_MARGIN_X, cm(4.1))
      .lineWidth(1.5)
      .strokeColor(AZUL)
      .stroke();

    // «Ciudad, fecha» a la derecha.
    const ciudad = centro.ciudad?.trim();
    const lugarFecha = `${ciudad ? `${ciudad}, ` : ""}${fechaLarga(certificado.fechaEmision)}`;
    doc
      .font("Times-Roman")
      .fontSize(12)
      .fillColor(TEXTO)
      .text(lugarFecha, PAGE_MARGIN_X, cm(5), { width: anchoUtil, align: "right" });

    // Título.
    doc
      .font("Times-Bold")
      .fontSize(17)
      .fillColor(AZUL)
      .text("CERTIFICADO MÉDICO", PAGE_MARGIN_X, cm(6.6), { width: anchoUtil, align: "center" });

    // Cuerpo justificado.
    const { cuerpo, cierre } = textoCertificado({
      paciente: datos.paciente,
      fechaAtencion: certificado.fecha,
      diagnosticoCie10: certificado.diagnosticoCie10,
      compromiso: certificado.compromiso,
      piezas: certificado.piezas,
      procedimiento: certificado.procedimiento,
      recomendacion: certificado.recomendacion,
      motivo: certificado.motivo,
      observaciones: certificado.observaciones,
    });
    doc.font("Times-Roman").fontSize(13).fillColor(TEXTO);
    let y = cm(8.4);
    for (const parrafo of [...cuerpo, cierre]) {
      doc.text(parrafo, PAGE_MARGIN_X, y, { width: anchoUtil, align: "justify", lineGap: 7 });
      y = doc.y + cm(0.6);
    }

    // Firma: si no cabe, pasa a una hoja nueva (con «Atentamente» incluido).
    const yPie = doc.page.height - cm(3.2);
    if (y + cm(7.2) > yPie) {
      doc.addPage();
      y = cm(3);
    }
    doc.font("Times-Roman").fontSize(13).fillColor(TEXTO).text("Atentamente,", PAGE_MARGIN_X, y + cm(0.4), {
      width: anchoUtil,
      align: "center",
    });
    y = doc.y + cm(0.3);

    const altoFirma = cm(2.4);
    if (datos.sello) {
      dibujarSello(doc, datos.sello, y + altoFirma, (ancho - cm(8.5)) / 2);
    } else if (datos.firma) {
      try {
        doc.image(datos.firma, (ancho - cm(5)) / 2, y, { fit: [cm(5), altoFirma - cm(0.2)], align: "center" });
      } catch {
        // La firma es opcional: si la imagen no es válida, el PDF igual se genera.
      }
    }
    y += altoFirma + cm(0.2);

    doc.font("Times-Bold").fontSize(13).fillColor(TEXTO).text(profesional.nombreCompleto, PAGE_MARGIN_X, y, {
      width: anchoUtil,
      align: "center",
    });
    const cargo = profesional.cargo?.trim();
    if (cargo) {
      doc.font("Times-Bold").fontSize(12).text(cargo.toUpperCase(), PAGE_MARGIN_X, doc.y, { width: anchoUtil, align: "center" });
    }
    if (profesional.registroProfesional) {
      doc
        .font("Times-Roman")
        .fontSize(10)
        .fillColor(GRIS)
        .text(`Registro: ${profesional.registroProfesional}`, PAGE_MARGIN_X, doc.y + cm(0.05), {
          width: anchoUtil,
          align: "center",
        });
    }

    // Pie: dirección y teléfono del centro (o el pie configurado) y el código del documento.
    const datosPie = [centro.direccion, centro.telefono].filter((v) => v?.trim()).join("   ·   ") || centro.piePdf;
    doc
      .moveTo(PAGE_MARGIN_X, yPie)
      .lineTo(ancho - PAGE_MARGIN_X, yPie)
      .lineWidth(1)
      .strokeColor(AZUL)
      .stroke();
    doc
      .font("Times-Roman")
      .fontSize(11)
      .fillColor(TEXTO)
      .text(datosPie, PAGE_MARGIN_X, yPie + cm(0.3), { width: anchoUtil, align: "center" });
    doc
      .font("Times-Roman")
      .fontSize(8)
      .fillColor(GRIS)
      .text(`Código: ${certificado.codigoUnico}`, PAGE_MARGIN_X, doc.y + cm(0.2), { width: anchoUtil, align: "center" });

    doc.end();
  });
}
