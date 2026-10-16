/** Catálogo CIE-10 de uso odontológico (capítulo XI, K00–K14, más traumatismos y exámenes frecuentes). */

export interface Cie10 {
  codigo: string;
  descripcion: string;
}

const c = (codigo: string, descripcion: string): Cie10 => ({ codigo, descripcion });

export const CIE10_ODONTOLOGIA: readonly Cie10[] = [
  // K00 Trastornos del desarrollo y de la erupción de los dientes
  c("K00.0", "Anodoncia"),
  c("K00.1", "Dientes supernumerarios"),
  c("K00.2", "Anomalías del tamaño y de la forma del diente"),
  c("K00.3", "Dientes moteados (fluorosis)"),
  c("K00.4", "Alteraciones en la formación dentaria"),
  c("K00.5", "Alteraciones hereditarias de la estructura dentaria, no clasificadas en otra parte"),
  c("K00.6", "Alteraciones en la erupción dentaria"),
  c("K00.7", "Síndrome de la dentición"),
  c("K00.8", "Otros trastornos del desarrollo de los dientes"),
  c("K00.9", "Trastorno del desarrollo de los dientes, no especificado"),
  // K01 Dientes incluidos e impactados
  c("K01.0", "Dientes incluidos"),
  c("K01.1", "Dientes impactados"),
  // K02 Caries dental
  c("K02.0", "Caries limitada al esmalte"),
  c("K02.1", "Caries de la dentina"),
  c("K02.2", "Caries del cemento"),
  c("K02.3", "Caries dentaria detenida"),
  c("K02.4", "Odontoclasia"),
  c("K02.8", "Otras caries dentales"),
  c("K02.9", "Caries dental, no especificada"),
  // K03 Otras enfermedades de los tejidos duros de los dientes
  c("K03.0", "Atrición excesiva de los dientes"),
  c("K03.1", "Abrasión de los dientes"),
  c("K03.2", "Erosión de los dientes"),
  c("K03.3", "Reabsorción patológica de los dientes"),
  c("K03.4", "Hipercementosis"),
  c("K03.5", "Anquilosis de los dientes"),
  c("K03.6", "Depósitos [accesorios] en los dientes (placa, sarro, cálculo)"),
  c("K03.7", "Cambios posteruptivos del color de los tejidos duros de los dientes"),
  c("K03.8", "Otras enfermedades especificadas de los tejidos duros de los dientes"),
  c("K03.9", "Enfermedad de los tejidos duros de los dientes, no especificada"),
  // K04 Enfermedades de la pulpa y de los tejidos periapicales
  c("K04.0", "Pulpitis"),
  c("K04.1", "Necrosis de la pulpa"),
  c("K04.2", "Degeneración de la pulpa"),
  c("K04.3", "Formación anormal de tejido duro en la pulpa"),
  c("K04.4", "Periodontitis apical aguda originada en la pulpa"),
  c("K04.5", "Periodontitis apical crónica (granuloma apical)"),
  c("K04.6", "Absceso periapical con fístula"),
  c("K04.7", "Absceso periapical sin fístula"),
  c("K04.8", "Quiste radicular"),
  c("K04.9", "Otras enfermedades de la pulpa y del tejido periapical, y las no especificadas"),
  // K05 Gingivitis y enfermedades periodontales
  c("K05.0", "Gingivitis aguda"),
  c("K05.1", "Gingivitis crónica"),
  c("K05.2", "Periodontitis aguda"),
  c("K05.3", "Periodontitis crónica"),
  c("K05.4", "Periodontosis"),
  c("K05.5", "Otras enfermedades periodontales"),
  c("K05.6", "Enfermedad periodontal, no especificada"),
  // K06 Otros trastornos de la encía y de la zona edéntula
  c("K06.0", "Retracción gingival"),
  c("K06.1", "Hiperplasia gingival"),
  c("K06.2", "Lesiones de la encía y de la zona edéntula asociadas con traumatismo"),
  c("K06.8", "Otros trastornos especificados de la encía y de la zona edéntula"),
  c("K06.9", "Trastorno de la encía y de la zona edéntula, no especificado"),
  // K07 Anomalías dentofaciales (incluso la maloclusión)
  c("K07.0", "Anomalías importantes del tamaño de los maxilares"),
  c("K07.1", "Anomalías de la relación maxilobasilar"),
  c("K07.2", "Anomalías de la relación entre los arcos dentarios"),
  c("K07.3", "Anomalías de la posición del diente (apiñamiento, diastema, rotación)"),
  c("K07.4", "Maloclusión de tipo no especificado"),
  c("K07.5", "Anomalías dentofaciales funcionales"),
  c("K07.6", "Trastornos de la articulación temporomandibular"),
  c("K07.8", "Otras anomalías dentofaciales"),
  c("K07.9", "Anomalía dentofacial, no especificada"),
  // K08 Otros trastornos de los dientes y de sus estructuras de sostén
  c("K08.0", "Exfoliación de los dientes debida a causas sistémicas"),
  c("K08.1", "Pérdida de dientes debida a accidente, extracción o enfermedad periodontal local"),
  c("K08.2", "Atrofia del reborde alveolar desdentado"),
  c("K08.3", "Raíz dental retenida"),
  c("K08.8", "Otros trastornos especificados de los dientes y de sus estructuras de sostén"),
  c("K08.9", "Trastorno de los dientes y de sus estructuras de sostén, no especificado"),
  // K09 Quistes de la región bucal
  c("K09.0", "Quistes odontogénicos del desarrollo"),
  c("K09.1", "Quistes del desarrollo (no odontogénicos) de la región bucal"),
  c("K09.2", "Otros quistes de los maxilares"),
  c("K09.8", "Otros quistes de la región bucal, no clasificados en otra parte"),
  c("K09.9", "Quiste de la región bucal, sin otra especificación"),
  // K10 Otras enfermedades de los maxilares
  c("K10.0", "Trastornos del desarrollo de los maxilares"),
  c("K10.1", "Granuloma central de células gigantes"),
  c("K10.2", "Afecciones inflamatorias de los maxilares (osteítis, osteomielitis)"),
  c("K10.3", "Alveolitis del maxilar (alvéolo seco)"),
  c("K10.8", "Otras enfermedades especificadas de los maxilares"),
  c("K10.9", "Enfermedad de los maxilares, no especificada"),
  // K11 Enfermedades de las glándulas salivales
  c("K11.0", "Atrofia de glándula salival"),
  c("K11.1", "Hipertrofia de glándula salival"),
  c("K11.2", "Sialoadenitis"),
  c("K11.3", "Absceso de glándula salival"),
  c("K11.5", "Sialolitiasis"),
  c("K11.6", "Mucocele de glándula salival"),
  c("K11.7", "Alteraciones de la secreción salival (xerostomía, sialorrea)"),
  // K12 Estomatitis y lesiones afines
  c("K12.0", "Estomatitis aftosa recurrente (aftas)"),
  c("K12.1", "Otras formas de estomatitis"),
  c("K12.2", "Celulitis y absceso de boca"),
  // K13 Otras enfermedades de los labios y de la mucosa bucal
  c("K13.0", "Enfermedades de los labios (queilitis)"),
  c("K13.1", "Mordedura del carrillo y del labio"),
  c("K13.2", "Leucoplasia y otras alteraciones del epitelio bucal, incluso de la lengua"),
  c("K13.3", "Leucoplasia pilosa"),
  c("K13.4", "Granuloma y lesiones semejantes de la mucosa bucal"),
  c("K13.5", "Fibrosis de la submucosa bucal"),
  c("K13.6", "Hiperplasia irritativa de la mucosa bucal"),
  c("K13.7", "Otras lesiones y las no especificadas de la mucosa bucal"),
  // K14 Enfermedades de la lengua
  c("K14.0", "Glositis"),
  c("K14.1", "Lengua geográfica"),
  c("K14.3", "Hipertrofia de las papilas linguales"),
  c("K14.6", "Glosodinia (lengua dolorosa)"),
  c("K14.8", "Otras enfermedades de la lengua"),
  // Infecciones de la boca
  c("B00.2", "Gingivoestomatitis y faringoamigdalitis herpética"),
  c("B37.0", "Estomatitis candidiásica (candidiasis oral)"),
  // Traumatismos y exámenes
  c("S02.5", "Fractura de los dientes"),
  c("S03.2", "Luxación de diente"),
  c("S02.6", "Fractura del maxilar inferior (mandíbula)"),
  c("Z01.2", "Examen odontológico"),
  c("Z29.8", "Otras medidas profilácticas especificadas (profilaxis, flúor, sellantes)"),
];

/** Minúsculas y sin acentos, para buscar sin importar cómo se escribió. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const SIN_PUNTO = (s: string) => s.replace(/[.\s]/g, "");

/**
 * Busca por código («K02», «k021») o por palabras de la descripción («caries dentina»).
 * Todas las palabras deben aparecer. Primero salen los códigos que empiezan igual,
 * luego las descripciones que empiezan con la búsqueda y después el resto.
 */
export function buscarCie10(texto: string, limite = 8, catalogo: readonly Cie10[] = CIE10_ODONTOLOGIA): Cie10[] {
  const q = normalizar(texto);
  if (!q) return [];
  const palabras = q.split(/\s+/);
  const qCodigo = SIN_PUNTO(q);

  const puntuados: { item: Cie10; puntos: number }[] = [];
  for (const item of catalogo) {
    const codigo = SIN_PUNTO(normalizar(item.codigo));
    const descripcion = normalizar(item.descripcion);
    let puntos = 0;
    if (codigo.startsWith(qCodigo)) puntos = 3;
    else if (palabras.every((p) => descripcion.includes(p) || codigo.includes(SIN_PUNTO(p)))) {
      puntos = descripcion.startsWith(q) ? 2 : 1;
    }
    if (puntos > 0) puntuados.push({ item, puntos });
  }
  return puntuados
    .sort((a, b) => b.puntos - a.puntos || a.item.codigo.localeCompare(b.item.codigo))
    .slice(0, limite)
    .map((p) => p.item);
}

/** `{codigo, descripcion}` → «K02.1 Caries de la dentina», el texto que se guarda en el certificado. */
export function textoCie10(item: Cie10): string {
  return `${item.codigo} ${item.descripcion}`;
}
