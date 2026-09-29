// Firebase sube solo el directorio functions/ y Cloud Build corre un `npm install`
// aislado ahí: una dependencia de workspace como "@cident/shared": "*" no existe en
// el registro npm y el build remoto falla con E404. Por eso se copia el paquete ya
// compilado a functions/vendor/ y se declara como dependencia `file:`, que sí viaja
// dentro del paquete subido.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raizFunctions = join(__dirname, "..");
const shared = join(raizFunctions, "..", "packages", "shared");
const destino = join(raizFunctions, "vendor", "cident-shared");

execFileSync("npm", ["run", "build"], {
  cwd: shared,
  stdio: "inherit",
  shell: process.platform === "win32",
});

rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
cpSync(join(shared, "dist"), join(destino, "dist"), { recursive: true });

const manifiesto = JSON.parse(readFileSync(join(shared, "package.json"), "utf8"));
delete manifiesto.scripts;
delete manifiesto.devDependencies;
writeFileSync(join(destino, "package.json"), `${JSON.stringify(manifiesto, null, 2)}\n`);
