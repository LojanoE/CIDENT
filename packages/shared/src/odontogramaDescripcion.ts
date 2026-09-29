import type { OdontogramaDoc } from "./types.js";

/**
 * Descripción textual del odontograma para el PDF de resumen de atención.
 * Puerto de `_generate_odontogram_description` (`ANTIGUO/app.py:1522-1603`),
 * adaptado a la forma de datos de Firestore (`OdontogramaDoc`, ya agrupada
 * por diente) en vez de la lista plana de registros SQL del sistema legado.
 */
export function generarDescripcionOdontograma(doc: OdontogramaDoc | null | undefined): string {
  const numeros = Object.keys(doc?.dientes ?? {})
    .map(Number)
    .sort((a, b) => a - b);

  if (numeros.length === 0) {
    return "Sin registros en el odontograma.";
  }

  const tipoOdontograma = doc!.tipo === "infantil" ? "Odontograma Infantil" : "Odontograma Adulto";
  const descripciones: string[] = [];

  for (const numero of numeros) {
    const dienteData = doc!.dientes[String(numero)];
    if (!dienteData) continue;

    const todasCondiciones: string[] = [];
    const agregar = (estados: readonly string[] | undefined) => {
      for (const e of estados ?? []) {
        if (!todasCondiciones.includes(e)) todasCondiciones.push(e);
      }
    };
    agregar(dienteData.general?.estados);
    for (const zonaEstado of Object.values(dienteData.zonas)) {
      agregar(zonaEstado?.estados);
    }

    let descDiente = `Diente ${numero}: `;
    descDiente += todasCondiciones.length > 0 ? todasCondiciones.join(", ") : "Sin estado definido";

    const detallesZonas: string[] = [];
    for (const [zonaNombre, zonaEstado] of Object.entries(dienteData.zonas)) {
      if (!zonaEstado) continue;
      const estadoTexto = zonaEstado.estados.length > 0 ? zonaEstado.estados.join(", ") : "Sin estado";
      const nota = zonaEstado.nota ? ` (${zonaEstado.nota})` : "";
      const zonaCapitalizada = zonaNombre.charAt(0).toUpperCase() + zonaNombre.slice(1);
      detallesZonas.push(`${zonaCapitalizada}: ${estadoTexto}${nota}`);
    }

    if (detallesZonas.length > 0) {
      descDiente += ` | Zonas: ${detallesZonas.join("; ")}`;
    }

    descripciones.push(descDiente);
  }

  if (descripciones.length === 0) {
    return "Sin registros en el odontograma.";
  }

  return `${tipoOdontograma}:\n${descripciones.join("\n")}`;
}
