// Siembra centros y usuarios iniciales en los EMULADORES (Auth + Firestore) para
// poder probar `login` de punta a punta y correr la "Demo de aislamiento" del plan F1.
//
// Uso (con los emuladores ya levantados en otra terminal):
//   firebase emulators:start --only auth,firestore,storage
//   node scripts/seed.mjs
//
// Este script SOLO habla con los emuladores: fija FIRESTORE_EMULATOR_HOST y
// FIREBASE_AUTH_EMULATOR_HOST antes de inicializar el Admin SDK, así que nunca
// puede tocar el proyecto real aunque falte credencial alguna.

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { hash } from "@node-rs/argon2";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "centro-dental-9223c";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.GCLOUD_PROJECT ??= PROJECT_ID;

const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const secretLocalPath = path.join(__dirname, "..", "functions", ".secret.local");

/**
 * El pepper debe ser el mismo que usará la CF `login` cuando corra contra el
 * emulador de Functions (que lee `functions/.secret.local`). Si el archivo no
 * existe todavía, generamos un pepper de desarrollo y lo dejamos escrito ahí.
 */
function obtenerPepperLocal() {
  if (existsSync(secretLocalPath)) {
    const contenido = readFileSync(secretLocalPath, "utf8");
    const match = contenido.match(/^LOGIN_PEPPER=(.*)$/m);
    if (match) return match[1];
  }
  const pepper = randomBytes(32).toString("hex");
  writeFileSync(secretLocalPath, `LOGIN_PEPPER=${pepper}\n`, { flag: "wx" });
  console.log(`Generado functions/.secret.local con un LOGIN_PEPPER de desarrollo nuevo.`);
  return pepper;
}

const PEPPER = obtenerPepperLocal();

initializeApp({ projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

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

const USUARIOS = [
  {
    usuario: "admin",
    password: "Admin1234!",
    centroId: "centroA",
    rol: "admin",
    nombreCompleto: "Administrador General",
    registroProfesional: "",
  },
  {
    usuario: "doctora",
    password: "Doctora1234!",
    centroId: "centroA",
    rol: "profesional",
    nombreCompleto: "Dra. Ana Pérez",
    registroProfesional: "MSP-0001-A",
  },
  {
    usuario: "doctorb",
    password: "Doctorb1234!",
    centroId: "centroB",
    rol: "profesional",
    nombreCompleto: "Dr. Beto Gómez",
    registroProfesional: "MSP-0002-B",
  },
];

async function sembrarCentros() {
  for (const { centroId, ...datos } of CENTROS) {
    await db.collection("centros").doc(centroId).set(datos, { merge: true });
    console.log(`centros/${centroId} OK`);
  }
}

async function sembrarUsuario({ usuario, password, centroId, rol, nombreCompleto, registroProfesional }) {
  const usuarioLower = usuario.toLowerCase();
  const usernameRef = db.collection("usernames").doc(usuarioLower);
  const existente = await usernameRef.get();

  if (existente.exists) {
    console.log(`usernames/${usuarioLower} ya existe, se omite (uid=${existente.data().uid}).`);
    return;
  }

  const { uid } = await auth.createUser({ disabled: false });
  const ahora = new Date().toISOString();

  await usernameRef.set({ uid });
  await db.collection("users").doc(uid).set({
    uid,
    centroId,
    rol,
    usuario: usuarioLower,
    nombreCompleto,
    registroProfesional,
    activo: true,
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: ahora,
    updatedAt: ahora,
  });

  const passwordHash = await hash(password + PEPPER, ARGON2_OPTIONS);
  await db.collection("userSecrets").doc(uid).set({ passwordHash });
  await auth.setCustomUserClaims(uid, { centroId, rol });

  console.log(`users/${uid} (${usuarioLower}, ${centroId}, ${rol}) OK`);
}

await sembrarCentros();
for (const u of USUARIOS) {
  await sembrarUsuario(u);
}

console.log("\nListo. Credenciales de prueba:");
for (const { usuario, password, centroId, rol } of USUARIOS) {
  console.log(`  ${usuario} / ${password}  (${centroId}, ${rol})`);
}
