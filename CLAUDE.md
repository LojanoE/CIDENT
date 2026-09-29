# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

Monorepo con npm workspaces (`packages/shared`, `web`, `functions`), orquestado desde el `package.json` raíz.

```bash
npm run build          # shared → web → functions, en ese orden (functions depende del build de shared)
npm run typecheck      # shared → web → functions
npm run lint           # eslint . (todo el repo)
npm run test           # SOLO packages/shared (vitest run) — functions y web tienen su propio test, no están enganchados a la raíz
npm run test:rules     # firestore.rules/storage.rules contra el emulador (functions/test/rules.test.ts)
npm run emulators      # firebase emulators:start --only auth,firestore,functions,storage,hosting
npm run seed           # siembra centros + usuarios de prueba en los EMULADORES (scripts/seed.mjs)
npm run dev             # vite dev server (workspace web)
```

Tests de un solo workspace o un solo archivo:

```bash
npm run test --workspace=packages/shared -- edad.test.ts
npm run test --workspace=functions -- imagen.test.ts
npx vitest run functions/test/imagen.test.ts    # equivalente, desde la raíz
```

`npm run test:rules` requiere el emulador de Firestore, que a su vez requiere JDK ≥ 21. Si no hay JDK disponible en la máquina, ese comando (y cualquier prueba end-to-end contra emuladores) no puede correr localmente; sigue corriendo en CI (`.github/workflows/ci.yml`, job `rules-tests`).

CI (`.github/workflows/ci.yml`) corre dos jobs: `build-and-test` (typecheck, lint, test de shared, build) y `rules-tests` (depende del primero; instala `firebase-tools` global y corre `test:rules` contra el emulador).

## Arquitectura

### Los tres workspaces y el vendoring de `functions`

`functions` depende de `@cident/shared` (`packages/shared`), pero Firebase sube solo el directorio `functions/` y Cloud Build corre un `npm install` aislado ahí: una dependencia de workspace (`"@cident/shared": "*"`) no existe en el registro npm y el build remoto falla con E404.

Por eso `functions/scripts/vendorizarShared.mjs` compila `packages/shared` y copia el `dist/` resultante a `functions/vendor/cident-shared/`, declarado como dependencia `file:` (que sí viaja con el paquete subido). Este script corre automáticamente como parte del `build` de `functions` (`node scripts/vendorizarShared.mjs && tsc -p tsconfig.json && node scripts/copiarAssets.mjs`), que a su vez es el hook `predeploy` de Firebase (`firebase.json`). **Si editás `packages/shared` y necesitás que `functions` vea el cambio sin hacer un build/deploy completo, corré el vendoring a mano**: `node functions/scripts/vendorizarShared.mjs`.

### Autenticación propia (no Firebase Auth con proveedor externo)

El login **no** usa el flujo estándar de email/password de Firebase Auth. Es un sistema propio construido sobre Firebase Auth solo como portador de sesión:

- `usernames/{usuario}` → `{ uid }` (lookup de usuario a uid).
- `users/{uid}` → perfil (`centroId`, `rol`, `activo`, `failedAttempts`, `lockedUntil`, ...).
- `userSecrets/{uid}` → `passwordHash` (argon2id), colección separada de `users` para no exponer el hash en lecturas normales del perfil.
- La Cloud Function callable `login` (`functions/src/auth/login.ts`) combina la contraseña con un pepper del lado servidor (`LOGIN_PEPPER`, Secret Manager, ver `functions/src/lib/pepper.ts`) antes de verificar con argon2 (`functions/src/lib/argon2.ts`). Incluye mitigación de timing attack (hash dummy cuando el usuario no existe), rate limiting por IP (`functions/src/lib/rateLimit.ts`), bloqueo de cuenta tras intentos fallidos, y auditoría en cada rama de salida (`functions/src/lib/auditoria.ts`).
- Si el login es exitoso, la función fija `centroId`/`rol` con `setCustomUserClaims` y devuelve un custom token (`createCustomToken`). El cliente (`web/src/app/AuthProvider.tsx`) intercambia ese token con `signInWithCustomToken` y de ahí en más usa el `onAuthStateChanged` estándar de Firebase Auth, leyendo `centroId`/`rol` de `idTokenResult.claims`.
- App Check/reCAPTCHA está deliberadamente **desactivado** (`enforceAppCheck: false` en `login.ts`) — requiere configurar un sitio en la consola de Firebase primero. No lo actives sin que el usuario lo pida explícitamente.

### Aislamiento multi-tenant (`centroId` / `rol`)

Cada centro de salud es un tenant. El aislamiento se aplica en tres capas independientes que deben mantenerse consistentes entre sí:

1. **`firestore.rules`** y **`storage.rules`**: rules-as-code con helpers (`signedIn()`, `esAdmin()`, `miCentro()`, `puedeLeer()`, etc.) que comparan el `centroId`/`rol` del token contra el documento/ruta accedido. Catchall `deny` por defecto al final de ambos archivos.
2. **`functions/src/lib/guards.ts`**: `requireAuth(request)` y `requireAdmin(request)` — mismas validaciones de claims pero del lado servidor, para las callables. Toda callable que toca datos de un centro debe llamar a una de estas dos al principio.
3. Las **collection-group queries** (p. ej. sobre `visits` o `attachments` a través de pacientes) requieren filtrar por `centroId` **del lado del cliente**: las rules revalidan cada doc individualmente pero no inyectan el filtro por vos.

Rol: solo `"admin"` y `"profesional"`. Un admin gestiona su propio centro (usuarios, datos del centro); nunca cruza a datos de otro `centroId` — ni las rules ni los guards lo permiten.

### Estructura de `functions/src`

- `auth/` — callables de autenticación y gestión de usuarios (`login`, `crearUsuario`, `actualizarUsuario`, `cambiarPassword`).
- `admin/` — callables de administración de centros (`actualizarCentro`).
- `documentos/` — callables que generan PDFs (`generarReceta`, `generarCertificado`, `generarResumenAtencion`); orquestan: cargar datos de Firestore → descargar assets de Storage (firma, logo) → delegar a `pdf/`.
- `pdf/` — capa de bajo nivel con pdfkit: `layout.ts` tiene los primitivos compartidos por los tres documentos (encabezado con logo, bloques de texto, pie de página con firma), `firma.ts`/`logo.ts` descargan esos assets desde Storage devolviendo `null` en cualquier fallo (son decorativos: el PDF se genera igual sin ellos), y `receta.ts`/`certificado.ts`/`atencion.ts` arman cada documento concreto.
- `storage/onAdjuntoSubido.ts` — trigger `onObjectFinalized` (background, no HTTPS) que mueve adjuntos subidos a `uploads/{centroId}/{uid}/{nombreArchivo}` (staging) hacia su ubicación definitiva `centros/{centroId}/pacientes/{patientId}/adjuntos/...`, validando que el `centroId` de la ruta coincida con el del paciente/visita antes de crear el doc en `attachments`.
- `lib/` — primitivos transversales: `guards.ts` (autorización), `pepper.ts`/`argon2.ts` (hashing), `rateLimit.ts`, `auditoria.ts` (`registrarAuditoria`, nunca lanza — un fallo de auditoría no debe romper el flujo que la origina), `imagen.ts` (valida imágenes por *magic bytes*, no por el MIME declarado por el cliente).
- `index.ts` — único entrypoint que exporta todas las callables/triggers. `initializeApp()` se llama una sola vez ahí; el resto de los módulos importan `firebase-admin/*` directamente (no reexportan instancias) para mantener el cold-start acotado por función.

**Restricción de Cloud Functions gen2**: no se puede convertir una función HTTPS a background-triggered (o viceversa) sin borrarla primero (`firebase functions:delete <nombre> --region <region>`) y volver a desplegar. Pasa al revés también.

### `packages/shared`

Tipos TypeScript y schemas zod compartidos entre `functions` y `web` (vendorizados hacia `functions`, ver arriba; consumidos directo vía workspace en `web`). Incluye lógica de dominio pura y testeable sin infraestructura: `odontograma.ts`, `cpo.ts`, `higiene.ts`, `edad.ts`, `odontogramaDescripcion.ts`, además de `types.ts` (interfaces de dominio: `Centro`, `LogoCentro`, `Adjunto`, ...) y `schemas.ts` (zod, usados tanto para validar server-side en las callables como con `zodResolver` en los formularios de `web`).

**Gotcha de `httpsCallable`**: los argumentos pasan por serialización, y `undefined` se convierte en `null` en el otro extremo. Los schemas de campos opcionales usan el patrón `.nullable().optional().transform(v => v ?? undefined)` para tolerar ambos.

### Modelo de datos Firestore

- `patients/{patientId}/visits/{visitId}/detalle/{docId}` — una visita se vuelve inmutable (`estado == 'final'`) salvo para admins.
- Subcolecciones generadas solo por el backend (nunca escritas directo por el cliente): `prescriptions`, `certificates`, `attachments`.
- `centros/{centroId}` — editable solo vía la callable `actualizarCentro` (Admin SDK); `firestore.rules` lo deja con `allow write: if false` para clientes.
- `auditLogs` — append-only, lectura solo para admin, escrita únicamente por `registrarAuditoria`.

### Despliegue

- `firebase deploy --only functions,hosting` procesa las functions **antes** de finalizar/activar (release) el hosting. Un error en una fase posterior a functions pero previa al release de hosting (p. ej. falla al configurar la cleanup policy de Artifact Registry en una región nueva) puede dejar los archivos de hosting subidos pero **sin activar**, sirviendo en silencio la versión anterior aunque el log de functions muestre todo en verde. Si el sitio no refleja un deploy "exitoso", desplegar hosting aislado (`firebase deploy --only hosting`) para confirmar que llega hasta "release complete", y comparar el hash de los assets de `web/dist` contra los que sirve la URL en vivo.
- `index.html` se sirve con `Cache-Control: max-age=3600` por defecto (no hay `headers` custom en `firebase.json`), así que un deploy recién activado puede tardar hasta una hora en reflejarse en navegadores con caché.
- Los assets de Vite (`web/dist/assets/*`) llevan hash de contenido en el nombre de archivo — sirven como señal de diagnóstico confiable para saber si lo que está en producción coincide con el build local.
