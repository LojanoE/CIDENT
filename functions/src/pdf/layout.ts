import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import type { Centro } from "@cident/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, "assets");

/** Puntos por centímetro (72 pt/pulgada ÷ 2.54 cm/pulgada). */
export const CM = 28.3464567;
export function cm(valor: number): number {
  return valor * CM;
}

export const PAGE_MARGIN_X = cm(2);
const AZUL_CLARO = "#e6f2ff";
const AZUL_TITULO = "#1a3a5c";
const GRIS_TEXTO = "#333333";

export interface ProfesionalPdf {
  nombreCompleto: string;
  registroProfesional: string;
}

export function crearDocumento(): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  doc.registerFont("Regular", join(ASSETS_DIR, "FiraSans-Regular.ttf"));
  doc.registerFont("Bold", join(ASSETS_DIR, "FiraSans-Bold.ttf"));
  doc.font("Regular");
  return doc;
}

/**
 * Encabezado con logo, título y línea divisoria. Devuelve el Y a partir del
 * cual puede empezar el contenido del documento.
 *
 * `logo` es el logo propio del centro (ver `obtenerLogoBuffer`); si no tiene
 * uno configurado, se usa el logo CIDENT de los assets.
 */
export function dibujarEncabezado(
  doc: PDFKit.PDFDocument,
  titulo: string,
  logo?: Buffer | null,
): number {
  const anchoPagina = doc.page.width;

  try {
    // `fit` escala dentro de la caja preservando la proporción: los logos de
    // los centros tienen relaciones de aspecto arbitrarias y forzar ancho y
    // alto a la vez los deformaría.
    // Sin `valign`: pdfkit alinea arriba por defecto dentro de la caja de `fit`.
    doc.image(logo ?? join(ASSETS_DIR, "CIDENT.png"), anchoPagina - cm(4.5), cm(1.5), {
      fit: [cm(2.5), cm(2)],
      align: "right",
    });
  } catch {
    // El logo es decorativo: si el archivo no está disponible, el PDF igual se genera.
  }

  doc
    .font("Bold")
    .fontSize(18)
    .fillColor(AZUL_TITULO)
    .text(titulo, PAGE_MARGIN_X, cm(1.5), { width: anchoPagina - cm(2) - PAGE_MARGIN_X });

  doc
    .moveTo(PAGE_MARGIN_X, cm(3.7))
    .lineTo(anchoPagina - PAGE_MARGIN_X, cm(3.7))
    .lineWidth(2)
    .strokeColor(AZUL_TITULO)
    .stroke();

  doc.fillColor(GRIS_TEXTO).font("Regular");
  return cm(4.2);
}

/**
 * Bloque de texto con encabezado sobre fondo azul claro y cuerpo con wrap
 * nativo de pdfkit. Devuelve el Y siguiente al bloque.
 */
export function bloqueTexto(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  ancho: number,
  titulo: string,
  texto: string,
): number {
  const alturaTitulo = cm(0.6);
  doc.rect(x, y, ancho, alturaTitulo).fill(AZUL_CLARO);
  doc
    .fillColor(AZUL_TITULO)
    .font("Bold")
    .fontSize(12)
    .text(titulo, x + cm(0.15), y + cm(0.12), { width: ancho - cm(0.3) });

  const yCuerpo = y + alturaTitulo + cm(0.2);
  doc
    .fillColor(GRIS_TEXTO)
    .font("Regular")
    .fontSize(10)
    .text(texto || "—", x, yCuerpo, { width: ancho, lineGap: 2 });

  return doc.y + cm(0.3);
}

/**
 * Inserta un salto de página manual si no queda espacio suficiente antes del
 * pie de página. La paginación automática de pdfkit no sirve aquí porque el
 * layout de columnas se posiciona a mano.
 */
export function asegurarEspacio(doc: PDFKit.PDFDocument, y: number, minimo: number): number {
  const limite = doc.page.height - cm(4);
  if (y + minimo > limite) {
    doc.addPage();
    return cm(2);
  }
  return y;
}

/**
 * Pie de página fijo: línea divisoria, datos del centro (`centro.piePdf`),
 * nombre/registro real del profesional y, opcionalmente, imagen de firma
 * (usada solo en el certificado). Salta de página si el cursor actual ya
 * pasó la posición fija del pie.
 */
export function dibujarPie(
  doc: PDFKit.PDFDocument,
  centro: Centro,
  profesional: ProfesionalPdf,
  firma?: Buffer | string | null,
): void {
  const yLinea = doc.page.height - cm(4);
  if (doc.y > yLinea) {
    doc.addPage();
  }

  const anchoPagina = doc.page.width;

  doc
    .moveTo(PAGE_MARGIN_X, yLinea)
    .lineTo(anchoPagina - PAGE_MARGIN_X, yLinea)
    .lineWidth(1)
    .strokeColor(AZUL_TITULO)
    .stroke();

  if (firma) {
    try {
      doc.image(firma, PAGE_MARGIN_X, yLinea - cm(2.5), { width: cm(5), height: cm(2) });
    } catch {
      // La firma es opcional: si la imagen no es válida, el PDF igual se genera.
    }
  }

  doc
    .fillColor(GRIS_TEXTO)
    .font("Bold")
    .fontSize(10)
    .text(profesional.nombreCompleto, PAGE_MARGIN_X, yLinea + cm(0.2), {
      width: anchoPagina - 2 * PAGE_MARGIN_X,
      align: "center",
    });

  doc
    .font("Regular")
    .fontSize(9)
    .text(profesional.registroProfesional, PAGE_MARGIN_X, doc.y, {
      width: anchoPagina - 2 * PAGE_MARGIN_X,
      align: "center",
    });

  doc
    .fontSize(8)
    .fillColor("#666666")
    .text(centro.piePdf, PAGE_MARGIN_X, doc.y + cm(0.1), {
      width: anchoPagina - 2 * PAGE_MARGIN_X,
      align: "center",
    });
}
