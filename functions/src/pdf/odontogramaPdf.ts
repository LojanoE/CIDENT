import type {
  Condicion,
  EstadoDiente,
  Odontograma,
  OdontogramaDoc,
  PosicionGeometrica,
  Zona,
} from "@cident/shared";
import { CONDITION_SYMBOLS, FDI_PERMANENTES, FDI_TEMPORALES, zonaDeLado } from "@cident/shared";

const SIZE = 40;
const GAP = 10;
const PASO = SIZE + GAP;

/** Mismos cinco polígonos y centros que `web/src/features/odontograma/Diente.tsx`. */
const POLIGONOS: { posicion: PosicionGeometrica; puntos: [number, number][]; centro: [number, number] }[] = [
  { posicion: "centro", puntos: [[10, 10], [30, 10], [30, 30], [10, 30]], centro: [20, 20] },
  { posicion: "arriba", puntos: [[0, 0], [40, 0], [30, 10], [10, 10]], centro: [20, 5] },
  { posicion: "derecha", puntos: [[40, 0], [40, 40], [30, 30], [30, 10]], centro: [35, 20] },
  { posicion: "abajo", puntos: [[0, 40], [40, 40], [30, 30], [10, 30]], centro: [20, 35] },
  { posicion: "izquierda", puntos: [[0, 0], [0, 40], [10, 30], [10, 10]], centro: [5, 20] },
];

function colorDeZona(estado: EstadoDiente | undefined, zona: Zona): string {
  return estado?.zonas[zona]?.color ?? estado?.general?.color ?? "#ffffff";
}

function estadosDeZona(estado: EstadoDiente | undefined, zona: Zona): Condicion[] {
  return estado?.zonas[zona]?.estados ?? [];
}

/** Puerto vectorial de `ConditionMark.tsx`, centrado en (0,0) del CTM actual. */
function dibujarMarca(doc: PDFKit.PDFDocument, condicion: Condicion, color: string, r: number): void {
  const marca = CONDITION_SYMBOLS[condicion];
  switch (marca) {
    case "circulo":
      doc.circle(0, 0, r).fill(color);
      break;
    case "circulo-hueco":
      doc.circle(0, 0, r).lineWidth(1.5).stroke(color);
      break;
    case "triangulo":
      doc.polygon([0, -r], [r * 0.87, r * 0.5], [-r * 0.87, r * 0.5]).fill(color);
      break;
    case "cuadrado":
      doc.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6).fill(color);
      break;
    case "igual":
      doc
        .moveTo(-r, -r * 0.35)
        .lineTo(r, -r * 0.35)
        .moveTo(-r, r * 0.35)
        .lineTo(r, r * 0.35)
        .lineWidth(1.5)
        .stroke(color);
      break;
    case "asterisco":
      doc
        .moveTo(0, -r)
        .lineTo(0, r)
        .moveTo(-r * 0.87, -r * 0.5)
        .lineTo(r * 0.87, r * 0.5)
        .moveTo(-r * 0.87, r * 0.5)
        .lineTo(r * 0.87, -r * 0.5)
        .lineWidth(1.3)
        .stroke(color);
      break;
    case "aspa":
      doc
        .moveTo(-r, -r)
        .lineTo(r, r)
        .moveTo(-r, r)
        .lineTo(r, -r)
        .lineWidth(1.8)
        .stroke(color);
      break;
    case "puente":
      doc
        .path(`M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0`)
        .lineWidth(1.5)
        .stroke(color);
      break;
    case "parentesis":
      doc
        .path(`M ${-r * 0.5} ${-r} A ${r} ${r} 0 0 0 ${-r * 0.5} ${r}`)
        .lineWidth(1.5)
        .stroke(color);
      doc
        .path(`M ${r * 0.5} ${-r} A ${r} ${r} 0 0 1 ${r * 0.5} ${r}`)
        .lineWidth(1.5)
        .stroke(color);
      break;
  }
}

function dibujarDiente(doc: PDFKit.PDFDocument, fdi: number, estado: EstadoDiente | undefined): void {
  for (const { posicion, puntos, centro } of POLIGONOS) {
    const zona = zonaDeLado(fdi, posicion);
    const estados = estadosDeZona(estado, zona);
    const fill = colorDeZona(estado, zona);

    doc.lineWidth(1);
    doc.polygon(...puntos).fillAndStroke(fill, "#334155");

    const marcas = estados.slice(0, 3);
    marcas.forEach((condicion, i) => {
      const offset = (i - (Math.min(marcas.length, 3) - 1) / 2) * 6;
      doc.save();
      doc.translate(centro[0] + offset, centro[1]);
      dibujarMarca(doc, condicion, "#1a1a1a", 3.2);
      doc.restore();
    });
  }

  doc
    .fillColor("#334155")
    .font("Regular")
    .fontSize(9)
    .text(String(fdi), 0, SIZE + 6, { width: SIZE, align: "center" });
}

function dibujarArcada(
  doc: PDFKit.PDFDocument,
  fdis: readonly number[],
  yArcada: number,
  dientes: Odontograma,
): void {
  doc.save();
  doc.translate(0, yArcada);
  fdis.forEach((fdi, i) => {
    doc.save();
    doc.translate(i * PASO, 0);
    dibujarDiente(doc, fdi, dientes[String(fdi)]);
    doc.restore();
  });
  doc.restore();
}

/**
 * Dibuja el odontograma completo (misma geometría que `Odontograma.tsx`,
 * escalada para caber en `anchoDisponible`). Devuelve el Y siguiente al
 * gráfico.
 */
export function dibujarOdontograma(
  doc: PDFKit.PDFDocument,
  odonto: OdontogramaDoc | null | undefined,
  x: number,
  y: number,
  anchoDisponible: number,
): number {
  const secuencia = odonto?.tipo === "infantil" ? FDI_TEMPORALES : FDI_PERMANENTES;
  const mitad = secuencia.length / 2;
  const arcadaSuperior = secuencia.slice(0, mitad);
  const arcadaInferior = secuencia.slice(mitad);
  const dientes = odonto?.dientes ?? {};

  const anchoSvg = mitad * PASO;
  const altoSvg = 2 * (SIZE + 30) + GAP * 2;
  const escala = anchoDisponible / anchoSvg;

  const ySuperior = 10;
  const yInferior = ySuperior + SIZE + 30 + GAP;

  doc.save();
  doc.translate(x, y);
  doc.scale(escala);

  dibujarArcada(doc, arcadaSuperior, ySuperior, dientes);
  dibujarArcada(doc, arcadaInferior, yInferior, dientes);

  doc.restore();
  doc.font("Regular").fillColor("#333333");

  return y + altoSvg * escala;
}
