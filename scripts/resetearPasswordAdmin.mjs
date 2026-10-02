/**
 * Resetea la contraseña de un usuario admin en PRODUCCIÓN sin conocer la actual.
 *
 * A diferencia de `seedProduccion.mjs`, este script NO hashea la contraseña
 * localmente: delega el hashing a la callable `actualizarUsuario`, que corre con
 * el pepper que Secret Manager le inyecta — el mismo que usa `login` para
 * verificar. Así es imposible que el hash guardado y la verificación usen
 * peppers distintos (la causa de que un hash generado en la máquina del
 * operador, con el pepper copiado a mano, no valide nunca en el servidor).
 *
 * Para autenticarse como admin sin contraseña usa el Admin SDK: emite un custom
 * token para ese uid y lo canjea por un ID token, igual que hace la app después
 * de un login normal.
 *
 * Credenciales: alcanza con las Application Default Credentials de gcloud
 * (gcloud auth application-default login). Como no corre dentro de GCP, el Admin
 * SDK no puede descubrir en nombre de qué service account firmar el custom token,
 * así que se le indica explícitamente (ver SERVICE_ACCOUNTS abajo) y firma vía la
 * API IAM Credentials — para lo cual quien ejecuta necesita
 * iam.serviceAccounts.signBlob sobre esa cuenta (los roles Owner y Service Account
 * Token Creator lo incluyen).
 *
 * Uso (bash):
 *   ADMIN_PASSWORD=<contraseña nueva, 12+ caracteres> node scripts/resetearPasswordAdmin.mjs --confirmar
 *
 * La contraseña se lee del entorno y nunca se imprime, igual que los tokens.
 */
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ID = "centro-dental-9223c";
const REGION = "southamerica-east1";
/**
 * Cuentas de servicio candidatas para firmar el custom token, en orden de
 * preferencia. SERVICE_ACCOUNT_ID las sobreescribe si hiciera falta otra.
 */
const SERVICE_ACCOUNTS = process.env.SERVICE_ACCOUNT_ID
  ? [process.env.SERVICE_ACCOUNT_ID]
  : [`firebase-adminsdk-fbsvc@${PROJECT_ID}.iam.gserviceaccount.com`, `${PROJECT_ID}@appspot.gserviceaccount.com`];
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function abortar(mensaje) {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
}

for (const clave of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) {
  if (process.env[clave]) {
    abortar(`${clave} está definida: este script es para producción. Usá scripts/seed.mjs para los emuladores.`);
  }
}

if (!process.argv.includes("--confirmar")) {
  abortar(`Esto modifica PRODUCCIÓN (${PROJECT_ID}). Volvé a correrlo con --confirmar.`);
}

const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) {
  abortar("Definí ADMIN_PASSWORD con al menos 12 caracteres.");
}

const usuarioAdmin = (process.env.ADMIN_USUARIO ?? "admin").toLowerCase();

/** La API key web de Firebase es pública (viaja en el bundle de Vite). */
function obtenerApiKey() {
  if (process.env.VITE_FIREBASE_API_KEY) return process.env.VITE_FIREBASE_API_KEY;
  for (const archivo of ["web/.env.local", "web/.env"]) {
    try {
      const contenido = readFileSync(resolve(RAIZ, archivo), "utf8");
      const linea = contenido.split(/\r?\n/).find((l) => l.startsWith("VITE_FIREBASE_API_KEY="));
      if (linea) {
        const valor = linea.slice("VITE_FIREBASE_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
        if (valor) return valor;
      }
    } catch {
      // archivo ausente: probamos el siguiente
    }
  }
  abortar("No encontré la API key web. Definí VITE_FIREBASE_API_KEY o dejala en web/.env.local.");
}

const apiKey = obtenerApiKey();

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();
const auth = getAuth();

console.log(`\nProyecto: ${PROJECT_ID}`);
console.log(`Usuario a resetear: ${usuarioAdmin}\n`);

// 1. Resolver uid y claims desde Firestore.
const usernameSnap = await db.collection("usernames").doc(usuarioAdmin).get();
if (!usernameSnap.exists) {
  abortar(`usernames/${usuarioAdmin} no existe. Corré scripts/seedProduccion.mjs primero.`);
}
const uid = usernameSnap.data().uid;

const userSnap = await db.collection("users").doc(uid).get();
if (!userSnap.exists) {
  abortar(`users/${uid} no existe: el usuario quedó a medio crear.`);
}
const { centroId, rol } = userSnap.data();
if (rol !== "admin") {
  abortar(`${usuarioAdmin} tiene rol "${rol}". Este script solo resetea admins (actualizarUsuario exige rol admin).`);
}
console.log(`  uid=${uid} centroId=${centroId} rol=${rol}`);

// 2. La cuenta tiene que estar habilitada para poder canjear el custom token.
await auth.updateUser(uid, { disabled: false });
await db.collection("users").doc(uid).update({ activo: true });

// 3. Custom token con los claims explícitos (no dependemos de los persistidos).
await auth.setCustomUserClaims(uid, { centroId, rol });

// Firmar exige una service account nombrada: se prueba cada candidata hasta que
// una tenga permiso de signBlob (el error recién aparece al momento de firmar).
let customToken;
const fallosDeFirma = [];
for (const [i, serviceAccountId] of SERVICE_ACCOUNTS.entries()) {
  const appFirmante = initializeApp(
    { credential: applicationDefault(), projectId: PROJECT_ID, serviceAccountId },
    `firmante-${i}`,
  );
  try {
    customToken = await getAuth(appFirmante).createCustomToken(uid, { centroId, rol });
    console.log(`  custom token emitido (firmado como ${serviceAccountId})`);
    break;
  } catch (error) {
    fallosDeFirma.push(`  ${serviceAccountId}: ${error.message}`);
  }
}
if (!customToken) {
  const ayuda = [
    "No se pudo firmar el custom token con ninguna service account:",
    ...fallosDeFirma,
    "",
    "Otorgá el permiso de firma y reintentá:",
    `  gcloud iam service-accounts add-iam-policy-binding ${SERVICE_ACCOUNTS[0]} --member=user:<tu-cuenta> --role=roles/iam.serviceAccountTokenCreator --project=${PROJECT_ID}`,
  ];
  abortar(ayuda.join(String.fromCharCode(10)));
}

// 4. Canjearlo por un ID token.
const signIn = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  },
);
if (!signIn.ok) {
  const detalle = await signIn.text();
  abortar(`signInWithCustomToken falló (${signIn.status}): ${detalle}`);
}
const { idToken } = await signIn.json();
console.log("  ID token obtenido");

// 5. El servidor genera el hash con su propio pepper.
const respuesta = await fetch(`https://${REGION}-${PROJECT_ID}.cloudfunctions.net/actualizarUsuario`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
  body: JSON.stringify({ data: { uid, passwordNueva: password } }),
});
const cuerpo = await respuesta.text();
if (respuesta.status === 403) {
  abortar(
    "Cloud Run rechazó la llamada (403). Falta el binding de invoker:\n" +
      `  gcloud run services add-iam-policy-binding actualizarusuario --region=${REGION} ` +
      `--member=allUsers --role=roles/run.invoker --project=${PROJECT_ID}\n` +
      `Respuesta: ${cuerpo}`,
  );
}
if (!respuesta.ok) {
  abortar(`actualizarUsuario falló (${respuesta.status}): ${cuerpo}`);
}
let resultado;
try {
  resultado = JSON.parse(cuerpo);
} catch {
  abortar(`actualizarUsuario devolvió una respuesta ilegible: ${cuerpo}`);
}
if (!resultado.result?.ok) {
  abortar(`actualizarUsuario no confirmó el cambio: ${cuerpo}`);
}
console.log("  contraseña rehasheada por el servidor (pepper del runtime)");

// 6. Limpiar los contadores anti-fuerza-bruta, que los intentos fallidos
//    acumulados bloquean el login incluso con la contraseña correcta.
await db.collection("users").doc(uid).update({
  failedAttempts: 0,
  lockedUntil: null,
  updatedAt: new Date().toISOString(),
});
console.log("  failedAttempts y lockedUntil reseteados");

const limites = await db.collection("rateLimits").listDocuments();
if (limites.length > 0) {
  const batch = db.batch();
  for (const ref of limites) batch.delete(ref);
  await batch.commit();
}
console.log(`  rateLimits limpiados (${limites.length} documento(s))`);

console.log(`\n✓ Listo. Ingresá con el usuario "${usuarioAdmin}" y la contraseña que pasaste en ADMIN_PASSWORD.\n`);
process.exit(0);
