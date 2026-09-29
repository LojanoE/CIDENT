import { getStorage } from "firebase-admin/storage";

const RUTA_FIRMA = "assets-privados/FIRMA.png";

/**
 * Descarga la firma escaneada del profesional desde una ruta del bucket que
 * `storage.rules` no expone a ningún cliente (solo el Admin SDK la lee).
 * Nunca se commitea ni se sirve al navegador. Falla en silencio: si aún no
 * se ha subido, el PDF se genera sin firma.
 */
export async function obtenerFirmaBuffer(): Promise<Buffer | null> {
  try {
    const [buffer] = await getStorage().bucket().file(RUTA_FIRMA).download();
    return buffer;
  } catch {
    return null;
  }
}
