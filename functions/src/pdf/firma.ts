import { getStorage } from "firebase-admin/storage";

const RUTA_FIRMA_GLOBAL = "assets-privados/FIRMA.png";

/** Rutas de la firma de cada profesional; `storage.rules` no las expone a ningún cliente. */
export function rutaCertificado(uid: string): string {
  return `assets-privados/firmas/${uid}/certificado.p12.enc`;
}
export function rutaManuscrita(uid: string): string {
  return `assets-privados/firmas/${uid}/manuscrita.png`;
}

export async function descargarOpcional(ruta: string): Promise<Buffer | null> {
  try {
    const [buffer] = await getStorage().bucket().file(ruta).download();
    return buffer;
  } catch {
    return null;
  }
}

/**
 * Firma dibujada del profesional; si no la tiene, la firma escaneada global
 * (compatibilidad con la instalación original). Nunca se commitea ni se sirve
 * al navegador. Falla en silencio: sin firma, el PDF se genera igual.
 */
export async function obtenerFirmaBuffer(uid?: string): Promise<Buffer | null> {
  if (uid) {
    const propia = await descargarOpcional(rutaManuscrita(uid));
    if (propia) return propia;
  }
  return descargarOpcional(RUTA_FIRMA_GLOBAL);
}
