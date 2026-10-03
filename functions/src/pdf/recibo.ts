import type { Centro, FormaPago, Paciente } from "@cident/shared";
import {
  PAGE_MARGIN_X,
  bloqueTexto,
  cm,
  crearDocumento,
  dibujarEncabezado,
  dibujarPie,
  type ProfesionalPdf,
} from "./layout.js";

export interface DatosRecibo {
  centro: Centro;
  profesional: ProfesionalPdf;
  paciente: Paciente;
  pago: {
    fecha: string;
    codigoUnico: string;
    concepto: string;
    presupuestoCodigo?: string;
    monto: number;
    formaPago: FormaPago;
    referencia?: string;
    /** Saldo pendiente del presupuesto tras este pago; solo si el pago es contra un presupuesto. */
    saldoDespues?: number;
  };
  firma: Buffer | null;
  logo: Buffer | null;
}

const AZUL_CLARO = "#e6f2ff";
const AZUL_TITULO = "#1a3a5c";
const GRIS_TEXTO = "#333333";

const dinero = (v: number) => `$ ${v.toFixed(2)}`;

const ETIQUETA_FORMA_PAGO: Record<FormaPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

export function generarPdfRecibo(datos: DatosRecibo): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = crearDocumento();
    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const p = datos.pago;
    const anchoUtil = doc.page.width - 2 * PAGE_MARGIN_X;
    let y = dibujarEncabezado(doc, "RECIBO DE PAGO", datos.logo);

    doc
      .fontSize(10)
      .fillColor(GRIS_TEXTO)
      .font("Regular")
      .text(`Recibo: ${p.codigoUnico}`, PAGE_MARGIN_X, y, { continued: true })
      .text(`   Fecha: ${p.fecha}`);
    y = doc.y + cm(0.3);

    y = bloqueTexto(
      doc,
      PAGE_MARGIN_X,
      y,
      anchoUtil,
      "RECIBIMOS DE",
      `${datos.paciente.apellidos} ${datos.paciente.nombres}  —  Cédula: ${datos.paciente.cedula}`,
    );

    const concepto = p.presupuestoCodigo ? `${p.concepto}\nPresupuesto ${p.presupuestoCodigo}` : p.concepto;
    y = bloqueTexto(doc, PAGE_MARGIN_X, y, anchoUtil, "CONCEPTO", concepto);

    // Monto en grande.
    doc.rect(PAGE_MARGIN_X, y, anchoUtil, cm(1.4)).fill(AZUL_CLARO);
    doc
      .fillColor(AZUL_TITULO)
      .font("Bold")
      .fontSize(12)
      .text("VALOR RECIBIDO", PAGE_MARGIN_X + cm(0.3), y + cm(0.5), { width: anchoUtil / 2 });
    doc
      .fontSize(20)
      .text(dinero(p.monto), PAGE_MARGIN_X + anchoUtil / 2, y + cm(0.35), {
        width: anchoUtil / 2 - cm(0.3),
        align: "right",
      });
    y += cm(1.9);

    const forma = ETIQUETA_FORMA_PAGO[p.formaPago] + (p.referencia ? `  —  Ref.: ${p.referencia}` : "");
    y = bloqueTexto(doc, PAGE_MARGIN_X, y, anchoUtil, "FORMA DE PAGO", forma);

    if (p.saldoDespues !== undefined) {
      const texto = p.saldoDespues > 0 ? `Saldo pendiente del presupuesto: ${dinero(p.saldoDespues)}` : "Presupuesto cancelado en su totalidad.";
      bloqueTexto(doc, PAGE_MARGIN_X, y, anchoUtil, "SALDO", texto);
    }

    dibujarPie(doc, datos.centro, datos.profesional, datos.firma);

    doc.end();
  });
}
