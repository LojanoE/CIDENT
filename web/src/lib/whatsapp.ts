/**
 * Enlace `wa.me` con un texto prellenado. Solo dígitos; sin prefijo de país no se
 * puede armar un enlace confiable, así que en ese caso se omite el número y
 * WhatsApp deja elegir el contacto.
 */
export function enlaceWhatsApp(telefono: string, texto: string): string {
  const digitos = telefono.replace(/\D/g, "");
  let numero = "";
  if (digitos.startsWith("593")) numero = digitos;
  else if (digitos.startsWith("09") && digitos.length === 10) numero = `593${digitos.slice(1)}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
