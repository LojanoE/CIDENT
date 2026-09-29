// Siembra los centros y el usuario admin inicial en el proyecto REAL.
//
// Existe aparte de scripts/seed.mjs porque ese script fija los hosts de emulador
// a propósito (nunca puede tocar producción) y porque el primer admin no se puede
// crear con la Cloud Function `crearUsuario`: empieza con requireAdmin(), así que
// haría falta un admin previo para crear el primer admin.
//
// El pepper y la contraseña se leen del entorno y nunca se imprimen: quien ejecuta
// el script es el único que ve esos valores.
//
// Uso (PowerShell, en la terminal del usuario):
//   $env:LOGIN_PEPPER = (firebase functions:secrets:access LOGIN_PEPPER --project centro-dental-9223c)
//   $env:ADMIN_PASSWORD = "<contraseña fuerte para el admin>"
//   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\LojanoE\Documents\CIDENT-SECRETOS\serviceAccount.json"
//   node scripts/seedProduccion.mjs --confirmar
//
// La clave de cuenta de servicio se descarga de la consola de Firebase
// (Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada)
// y debe quedar FUERA del repositorio. Alternativa sin archivo de clave, si hay
// gcloud instalado: `gcloud auth application-default login`.

import { hash } from "@node-rs/argon2";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "centro-dental-9223c";
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

const CENTROS = [
  {
    centroId: "centroA",
    nombre: "Centro de Salud A",
    direccion: "Av. Principal 123",
    telefono: "022345678",
    piePdf: "Centro de Salud A — Av. Principal 123 — Tel. 022345678",
  },
  {
    centroId: "centroB",
    nombre: "Centro de Salud B",
    direccion: "Calle Secundaria 456",
    telefono: "022987654",
    piePdf: "Centro de Salud B — Calle Secundaria 456 — Tel. 022987654",
  },
];

function abortar(mensaje) {
  console.error(`\n  ${mensaje}\n`);
  process.exit(1);
}

// Un host de emulador definido en el entorno desviaría silenciosamente toda la
// siembra al emulador y el script terminaría diciendo "OK" sin tocar producción.
for (const variable of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) {
  if (process.env[variable]) {
    abortar(`${variable} está definida (${process.env[variable]}). Este script es para el proyecto real: abrí una terminal limpia.`);
  }
}

if (!process.argv.includes("--confirmar")) {
  abortar(`Esto escribe en el proyecto real ${PROJECT_ID}. Volvé a ejecutarlo con --confirmar si es lo que querés.`);
}

const pepper = process.env.LOGIN_PEPPER;
if (!pepper) {
  abortar("Falta LOGIN_PEPPER. Debe ser el MISMO valor que tiene el secreto en Secret Manager, o el login fallará para siempre.");
}

const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) {
  abortar("Falta ADMIN_PASSWORD, o tiene menos de 12 caracteres. Es la contraseña del admin en producción: que sea fuerte.");
}

const usuarioAdmin = (process.env.ADMIN_USUARIO ?? "admin").toLowerCase();
const nombreAdmin = process.env.ADMIN_NOMBRE ?? "Administrador General";

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

for (const { centroId, ...datos } of CENTROS) {
  await db.collection("centros").doc(centroId).set(datos, { merge: true });
  console.log(`centros/${centroId} OK`);
}

const usernameRef = db.collection("usernames").doc(usuarioAdmin);
const existente = await usernameRef.get();

if (existente.exists) {
  console.log(`\nusernames/${usuarioAdmin} ya existe (uid=${existente.data().uid}). No se crea de nuevo.`);
  console.log("Para cambiarle la contraseña usá la app con ese usuario, o borrá el documento y volvé a correr esto.");
} else {
  const { uid } = await auth.createUser({ disabled: false });
  const ahora = new Date().toISOString();

  await usernameRef.set({ uid });
  await db.collection("users").doc(uid).set({
    uid,
    centroId: CENTROS[0].centroId,
    rol: "admin",
    usuario: usuarioAdmin,
    nombreCompleto: nombreAdmin,
    registroProfesional: "",
    activo: true,
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: ahora,
    updatedAt: ahora,
  });
  await db.collection("userSecrets").doc(uid).set({ passwordHash: await hash(password + pepper, ARGON2_OPTIONS) });
  await auth.setCustomUserClaims(uid, { centroId: CENTROS[0].centroId, rol: "admin" });

  console.log(`\nusers/${uid} (${usuarioAdmin}, admin) OK`);
}

console.log("\nListo. Entrá a https://centro-dental-9223c.web.app con ese usuario y creá el resto desde Administración.");
