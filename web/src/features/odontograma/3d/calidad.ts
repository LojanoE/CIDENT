/**
 * Calidad gráfica automática: SSAO, sombras y resolución completa solo en equipos con
 * varios núcleos y memoria suficiente. En el resto (celulares modestos) se renderiza más liviano.
 * `deviceMemory` no existe en todos los navegadores; si falta se asume suficiente.
 */
export function calidadAlta(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.hardwareConcurrency ?? 4) > 4 && (nav.deviceMemory ?? 8) > 4;
}
