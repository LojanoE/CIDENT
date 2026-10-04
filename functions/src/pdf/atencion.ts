import type { Atencion, Centro, OdontogramaDoc, Paciente } from "@cident/shared";
import { calcularEdad } from "@cident/shared";
import { generarDescripcionOdontograma } from "@cident/shared";
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
import { dibujarOdontograma } from "./odontogramaPdf.js";

export interface DatosResumenAtencion {
  centro: Centro;
  profesional: ProfesionalPdf;
  paciente: Paciente;
  atencion: Atencion;
  odontograma: OdontogramaDoc | null;
  /** Ítems del plan marcados como realizados en esta atención (ya con pieza y nota). */
  tratamientosRealizados?: string[];
  firma: Buffer | null;
  logo: Buffer | null;
}

function textoEdad(fechaNacimiento: string): string {
  const edad = calcularEdad(fechaNacimiento);
  if (!edad) return "—";
  return `${edad.anios} años, ${edad.meses} meses`;
}

function bloqueDosColumnas(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  ancho: number,
  izquierda: { titulo: string; texto: string },
  derecha: { titulo: string; texto: string },
): number {
  const mitad = (ancho - cm(0.3)) / 2;
  const yFinIzquierda = bloqueTexto(doc, x, y, mitad, izquierda.titulo, izquierda.texto);
  const yFinDerecha = bloqueTexto(doc, x + mitad + cm(0.3), y, mitad, derecha.titulo, derecha.texto);
  return Math.max(yFinIzquierda, yFinDerecha);
}

export function generarPdfResumenAtencion(datos: DatosResumenAtencion): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = crearDocumento();
    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const anchoUtil = doc.page.width - 2 * PAGE_MARGIN_X;
    let y = dibujarEncabezado(doc, "RESUMEN DE ATENCIÓN", datos.logo);

    y = bloqueTexto(
      doc,
      PAGE_MARGIN_X,
      y,
      anchoUtil,
      "PACIENTE",
      `${datos.paciente.apellidos} ${datos.paciente.nombres}  —  Cédula: ${datos.paciente.cedula}  —  Edad: ${textoEdad(datos.paciente.fechaNacimiento)}`,
    );

    y = asegurarEspacio(doc, y, cm(3));
    y = bloqueDosColumnas(
      doc,
      PAGE_MARGIN_X,
      y,
      anchoUtil,
      { titulo: "FECHA", texto: datos.atencion.fecha },
      { titulo: "MOTIVO", texto: datos.atencion.motivo },
    );

    y = asegurarEspacio(doc, y, cm(3));
    y = bloqueTexto(doc, PAGE_MARGIN_X, y, anchoUtil, "PROBLEMA ACTUAL", datos.atencion.problemaActual);

    y = asegurarEspacio(doc, y, cm(3));
    y = bloqueTexto(doc, PAGE_MARGIN_X, y, anchoUtil, "ANTECEDENTES", datos.atencion.antecedentes);

    y = asegurarEspacio(doc, y, cm(3));
    y = bloqueDosColumnas(
      doc,
      PAGE_MARGIN_X,
      y,
      anchoUtil,
      { titulo: "SIGNOS VITALES", texto: datos.atencion.signosVitales },
      { titulo: "EXAMEN ESTOMATOGNÁTICO", texto: datos.atencion.examenEstomatognatico },
    );

    const indicadores = datos.atencion.indicadores;
    const cpo = datos.atencion.cpo;
    y = asegurarEspacio(doc, y, cm(3));
    y = bloqueDosColumnas(
      doc,
      PAGE_MARGIN_X,
      y,
      anchoUtil,
      {
        titulo: "ÍNDICES DE HIGIENE",
        texto: `Placa: ${indicadores.placa.toFixed(2)}  —  Cálculo: ${indicadores.calculo.toFixed(2)}  —  Gingivitis: ${indicadores.gingivitis.toFixed(2)}`,
      },
      {
        titulo: "CPO",
        texto: `C: ${cpo.c}  —  P: ${cpo.p}  —  O: ${cpo.o}  —  Total: ${cpo.total}`,
      },
    );

    if (datos.tratamientosRealizados && datos.tratamientosRealizados.length > 0) {
      y = asegurarEspacio(doc, y, cm(3));
      y = bloqueTexto(
        doc,
        PAGE_MARGIN_X,
        y,
        anchoUtil,
        "TRATAMIENTOS REALIZADOS",
        datos.tratamientosRealizados.map((t) => `• ${t}`).join("\n"),
      );
    }

    if (datos.atencion.notas) {
      y = asegurarEspacio(doc, y, cm(3));
      y = bloqueTexto(doc, PAGE_MARGIN_X, y, anchoUtil, "NOTAS", datos.atencion.notas);
    }

    doc.addPage();
    y = cm(2);
    doc
      .fillColor("#1a3a5c")
      .font("Bold")
      .fontSize(12)
      .text("ODONTOGRAMA", PAGE_MARGIN_X, y);
    y += cm(0.5);
    y = dibujarOdontograma(doc, datos.odontograma, PAGE_MARGIN_X, y, anchoUtil);

    y = asegurarEspacio(doc, y, cm(3));
    y += cm(0.3);
    bloqueTexto(
      doc,
      PAGE_MARGIN_X,
      y,
      anchoUtil,
      "DESCRIPCIÓN DETALLADA",
      generarDescripcionOdontograma(datos.odontograma),
    );

    dibujarPie(doc, datos.centro, datos.profesional, datos.firma);

    doc.end();
  });
}
