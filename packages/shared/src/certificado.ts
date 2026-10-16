/** Redacción del certificado médico (carta en prosa). Pura: la usan el PDF y la vista previa de la web. */

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** `2026-10-16` → «16 de octubre de 2026». Si no es una fecha ISO, la devuelve tal cual. */
export function fechaLarga(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mes = MESES[Number(m[2]) - 1];
  if (!mes) return iso;
  return `${Number(m[3])} de ${mes} de ${m[1]}`;
}

export interface DatosTextoCertificado {
  paciente: { nombres: string; apellidos: string; cedula: string };
  /** Fecha ISO de la atención. */
  fechaAtencion: string;
  diagnosticoCie10?: string;
  compromiso?: string;
  piezas?: string;
  procedimiento?: string;
  recomendacion?: string;
  /** Certificados anteriores a la plantilla en prosa. */
  motivo?: string;
  observaciones?: string;
}

export interface TextoCertificado {
  cuerpo: string[];
  cierre: string;
}

const limpiar = (v: string | undefined) => (v ?? "").trim().replace(/[\s.]+$/, "");

/** «30» → «30 %»; «30%» → «30 %»; texto libre se respeta. */
export function formatearCompromiso(v: string | undefined): string {
  const t = limpiar(v);
  if (/^\d+([.,]\d+)?\s*%?$/.test(t)) return `${t.replace(/\s*%$/, "")} %`;
  return t;
}

/** «K02.1 Caries de la dentina» → «K02.1 (Caries de la dentina)»; el texto libre queda igual. */
function conDescripcionEntreParentesis(dx: string): string {
  const m = /^([A-Z]\d{2}(?:\.\d)?)\s+(.+)$/.exec(dx);
  return m ? `${m[1]} (${m[2]})` : dx;
}

export const CIERRE_CERTIFICADO = "La presente certificación se expide por solicitud del paciente para fines pertinentes.";

/** Arma los párrafos omitiendo las frases cuyos datos están vacíos (nunca quedan huecos). */
export function textoCertificado(d: DatosTextoCertificado): TextoCertificado {
  const nombre = `${d.paciente.nombres} ${d.paciente.apellidos}`.replace(/\s+/g, " ").trim();
  const dx = (d.diagnosticoCie10 ?? "").split(";").map(limpiar).filter(Boolean);
  const compromiso = formatearCompromiso(d.compromiso);
  const piezas = limpiar(d.piezas);

  let primero =
    `Por medio del presente certifico haber atendido a ${nombre}, con cédula de identidad ${d.paciente.cedula}, ` +
    `el día ${fechaLarga(d.fechaAtencion)}, por el servicio de Consulta odontológica externa`;
  if (dx.length === 1) primero += ` con un diagnóstico CIE-10 ${conDescripcionEntreParentesis(dx[0] as string)}`;
  else if (dx.length > 1) primero += ` con los diagnósticos CIE-10 ${dx.map(conDescripcionEntreParentesis).join("; ")}`;
  if (compromiso && piezas) primero += `${dx.length ? "," : " con"} el ${compromiso} de compromiso de la pieza dental ${piezas}`;
  else if (piezas) primero += `${dx.length ? "," : " con"} compromiso de la pieza dental ${piezas}`;
  else if (compromiso) primero += `${dx.length ? "," : " con"} el ${compromiso} de compromiso`;
  primero += ".";

  const cuerpo = [primero];
  const procedimiento = limpiar(d.procedimiento);
  const recomendacion = limpiar(d.recomendacion);
  const motivo = limpiar(d.motivo);
  const observaciones = limpiar(d.observaciones);

  if (procedimiento) cuerpo.push(`Se procedió a realizar ${procedimiento}.`);
  if (recomendacion) cuerpo.push(`Se recomienda ${recomendacion}.`);
  if (motivo) cuerpo.push(`Motivo: ${motivo}.`);
  if (observaciones) cuerpo.push(`Observaciones: ${observaciones}.`);

  return { cuerpo, cierre: CIERRE_CERTIFICADO };
}
