import { type DiaLocal } from "@cident/shared";

/** Día local de hoy en la zona horaria del navegador ('YYYY-MM-DD'). */
export function hoyLocal(): DiaLocal {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

function fechaUtc(dia: DiaLocal): Date {
  return new Date(`${dia}T00:00:00Z`);
}

/** «lun 5 oct». La fecha se interpreta en UTC para que la zona del navegador no la corra un día. */
export function etiquetaDiaCorta(dia: DiaLocal): string {
  return fechaUtc(dia)
    .toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .replace(/\./g, "");
}

/** «lunes, 5 de octubre de 2026». */
export function etiquetaDiaLarga(dia: DiaLocal): string {
  return fechaUtc(dia).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
