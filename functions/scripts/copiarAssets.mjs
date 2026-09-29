// Copia los assets binarios de los PDFs (fuentes TTF, logo) desde src/ a lib/,
// porque tsc solo compila .ts y no los mueve al outDir por sí solo.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const origen = join(__dirname, "..", "src", "pdf", "assets");
const destino = join(__dirname, "..", "lib", "pdf", "assets");

mkdirSync(destino, { recursive: true });
cpSync(origen, destino, { recursive: true });
