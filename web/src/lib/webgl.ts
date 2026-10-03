/** `true` si el navegador puede crear un contexto WebGL (necesario para la vista 3D). */
export function soportaWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
