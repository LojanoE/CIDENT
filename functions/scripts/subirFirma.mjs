// Sube FIRMA.png (firma manuscrita escaneada) al bucket privado de Storage,
// en una ruta que storage.rules no expone a ningún cliente. Ejecutar a mano,
// fuera de git, apuntando al proyecto real:
//
//   node functions/scripts/subirFirma.mjs "C:\ruta\a\FIRMA.png" <projectId>
//
// Requiere credenciales de Application Default Credentials (gcloud auth
// application-default login) o GOOGLE_APPLICATION_CREDENTIALS apuntando a
// una service account con permiso de escritura en el bucket.
import { existsSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const [, , rutaLocal, projectId] = process.argv;

if (!rutaLocal || !projectId) {
  console.error("Uso: node subirFirma.mjs <ruta-local-FIRMA.png> <projectId>");
  process.exit(1);
}
if (!existsSync(rutaLocal)) {
  console.error(`No existe el archivo: ${rutaLocal}`);
  process.exit(1);
}

initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });

await getStorage().bucket().upload(rutaLocal, {
  destination: "assets-privados/FIRMA.png",
  contentType: "image/png",
});

console.log("Firma subida a assets-privados/FIRMA.png");
