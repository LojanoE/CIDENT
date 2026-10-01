import type { Centro, LineaPresupuesto, Paciente } from "@cident/shared";
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

export interface DatosPresupuesto {
  centro: Centro;
  profesional: ProfesionalPdf;
  paciente: Paciente;
  presupuesto: {
    fecha: string;
    codigoUnico: string;
    lineas: LineaPresupuesto[];
    subtotal: number;
    descuentoPorcentaje: number;
    descuento: number;
    ivaPorcentaje: number;
    iva: number;
    total: number;
    validezDias: number;
    observaciones: string;
  };
  firma: Buffer | null;
  logo: Buffer | null;
}

const AZUL_CLARO = "#e6f2ff";
const AZUL_TITULO = "#1a3a5c";
const GRIS_TEXTO = "#333333";

const dinero = (v: number) => `$ ${v.toFixed(2)}`;
const porcentaje = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(2)} %`;

/** Fecha de vencimiento (yyyy-MM-dd + días) como dd/MM/aaaa. */
function fechaValidez(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + dias);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function generarPdfPresupuesto(datos: DatosPresupuesto): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = crearDocumento();
    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const p = datos.presupuesto;
    const anchoUtil = doc.page.width - 2 * PAGE_MARGIN_X;
    let y = dibujarEncabezado(doc, "PRESUPUESTO ODONTOLÓGICO", datos.logo);

    doc
      .fontSize(10)
      .fillColor(GRIS_TEXTO)
      .font("Regular")
      .text(`Código: ${p.codigoUnico}`, PAGE_MARGIN_X, y, { continued: true })
      .text(`   Fecha: ${p.fecha}`);
    y = doc.y + cm(0.3);

    y = bloqueTexto(
      doc,
      PAGE_MARGIN_X,
      y,
      anchoUtil,
      "PACIENTE",
      `${datos.paciente.apellidos} ${datos.paciente.nombres}  —  Cédula: ${datos.paciente.cedula}`,
    );

    // Columnas de la tabla: tratamiento (resto), pieza, cantidad, precio unitario, total.
    const wPieza = cm(1.6);
    const wCant = cm(1.5);
    const wPrecio = cm(2.5);
    const wTotal = cm(2.5);
    const wTrat = anchoUtil - wPieza - wCant - wPrecio - wTotal;
    const xPieza = PAGE_MARGIN_X + wTrat;
    const xCant = xPieza + wPieza;
    const xPrecio = xCant + wCant;
    const xTotal = xPrecio + wPrecio;

    const encabezadoTabla = () => {
      doc.rect(PAGE_MARGIN_X, y, anchoUtil, cm(0.6)).fill(AZUL_CLARO);
      doc.fillColor(AZUL_TITULO).font("Bold").fontSize(10);
      const yt = y + cm(0.14);
      doc.text("Tratamiento", PAGE_MARGIN_X + cm(0.15), yt, { width: wTrat - cm(0.3) });
      doc.text("Pieza", xPieza, yt, { width: wPieza, align: "center" });
      doc.text("Cant.", xCant, yt, { width: wCant, align: "center" });
      doc.text("P. unit.", xPrecio, yt, { width: wPrecio - cm(0.15), align: "right" });
      doc.text("Total", xTotal, yt, { width: wTotal - cm(0.15), align: "right" });
      y += cm(0.8);
    };

    y = asegurarEspacio(doc, y, cm(3));
    encabezadoTabla();

    for (const linea of p.lineas) {
      doc.font("Regular").fontSize(10);
      const altoTexto = doc.heightOfString(linea.tratamiento, { width: wTrat - cm(0.3) });
      const alto = Math.max(altoTexto, cm(0.5)) + cm(0.2);
      const anterior = y;
      y = asegurarEspacio(doc, y, alto);
      if (y !== anterior) encabezadoTabla();

      doc.fillColor(GRIS_TEXTO).font("Regular").fontSize(10);
      doc.text(linea.tratamiento, PAGE_MARGIN_X + cm(0.15), y, { width: wTrat - cm(0.3) });
      doc.text(linea.pieza ?? "—", xPieza, y, { width: wPieza, align: "center" });
      doc.text(String(linea.cantidad), xCant, y, { width: wCant, align: "center" });
      doc.text(dinero(linea.precioUnitario), xPrecio, y, { width: wPrecio - cm(0.15), align: "right" });
      doc.text(dinero(linea.totalLinea), xTotal, y, { width: wTotal - cm(0.15), align: "right" });
      y += alto;
      doc
        .moveTo(PAGE_MARGIN_X, y - cm(0.1))
        .lineTo(PAGE_MARGIN_X + anchoUtil, y - cm(0.1))
        .lineWidth(0.5)
        .strokeColor("#cccccc")
        .stroke();
    }

    // Totales alineados a la derecha, bajo las columnas de precio y total.
    y = asegurarEspacio(doc, y + cm(0.2), cm(3.5));
    const filas: [string, string, boolean][] = [["Subtotal", dinero(p.subtotal), false]];
    if (p.descuento > 0) {
      filas.push([`Descuento (${porcentaje(p.descuentoPorcentaje)})`, `- ${dinero(p.descuento)}`, false]);
    }
    if (p.ivaPorcentaje > 0) filas.push([`IVA (${porcentaje(p.ivaPorcentaje)})`, dinero(p.iva), false]);
    filas.push(["TOTAL", dinero(p.total), true]);

    const xEtiqueta = xCant - cm(1.5);
    for (const [etiqueta, valor, fuerte] of filas) {
      if (fuerte) {
        doc.rect(xEtiqueta, y - cm(0.08), PAGE_MARGIN_X + anchoUtil - xEtiqueta, cm(0.65)).fill(AZUL_CLARO);
      }
      doc
        .fillColor(fuerte ? AZUL_TITULO : GRIS_TEXTO)
        .font(fuerte ? "Bold" : "Regular")
        .fontSize(fuerte ? 12 : 10);
      doc.text(etiqueta, xEtiqueta + cm(0.15), y, { width: xTotal - xEtiqueta - cm(0.3) });
      doc.text(valor, xTotal, y, { width: wTotal - cm(0.15), align: "right" });
      y += fuerte ? cm(0.8) : cm(0.55);
    }
    y += cm(0.2);

    doc
      .fillColor(GRIS_TEXTO)
      .font("Regular")
      .fontSize(10)
      .text(
        `Presupuesto válido por ${p.validezDias} días (hasta el ${fechaValidez(p.fecha, p.validezDias)}).`,
        PAGE_MARGIN_X,
        y,
        { width: anchoUtil },
      );
    y = doc.y + cm(0.4);

    if (p.observaciones) {
      y = asegurarEspacio(doc, y, cm(3));
      bloqueTexto(doc, PAGE_MARGIN_X, y, anchoUtil, "OBSERVACIONES / FORMA DE PAGO", p.observaciones);
    }

    dibujarPie(doc, datos.centro, datos.profesional, datos.firma);

    doc.end();
  });
}
