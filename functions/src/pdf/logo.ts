import type { Centro } from "@cident/shared";
import { getStorage } from "firebase-admin/storage";

/**
 * Descarga el logo propio del centro, subido desde el panel de administración.
 * Falla en silencio: si el centro no configuró ninguno, o el archivo no se puede
 * leer, el encabezado del PDF cae al logo CIDENT incluido en los assets.
 */
export async function obtenerLogoBuffer(centro: Centro): Promise<Buffer | null> {
  const storagePath = centro.logo?.storagePath;
  if (!storagePath) return null;
  try {
    const [buffer] = await getStorage().bucket().file(storagePath).download();
    return buffer;
  } catch {
    return null;
  }
}
