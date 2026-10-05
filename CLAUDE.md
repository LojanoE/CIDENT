# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Marca:** la plataforma/empresa proveedora se llama **Luna-Dental**. "CIDENT" es solo el nombre de *un* centro (el nombre del repo y del paquete `@cident/shared` son históricos). La UI muestra el nombre del centro (`centros/{centroId}.nombre`) dentro de la app y la marca Luna-Dental en el login y como firma pequeña.

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
- `patients/{patientId}/planTratamiento/{itemId}` — plan de tratamiento del paciente (ítems `pendiente`/`realizado`/`descartado`; `realizado.visitId` liga el ítem a la atención donde se hizo). Lo escribe el cliente (reglas con `centroValido`/`noMueveCentro`; no se borra un ítem realizado). Sin índices compuestos: se filtra por `centroId` y se ordena en el cliente.
- **Boca 3D (`web/src/features/odontograma/3d/`):** geometría procedural sin modelos externos. `geometrias.ts` arma una corona por tipo (anillos superelípticos + relieve oclusal, color por vértice) con 6 grupos en el orden de `EJES_GRUPOS` — la selección por cara usa `e.face.materialIndex`, no lo rompas. `Encia3D.tsx` barre la encía por la parábola de `arcada3d.ts` (`margenGingival`); con la encía visible las raíces se ocultan. Materiales cacheados en `materiales.ts`; el entorno usa `Lightformer` locales (sin HDRI por red). `calidad.ts` desactiva SSAO (N8AO) y sombras en equipos modestos.
- **Odontograma continuo:** una atención `draft` sin odontograma propio arranca con copia del último odontograma del paciente (`copiadoDe` guarda de qué atención); cada atención conserva su foto y la higiene no se copia. El historial por diente (`historialDiente` en `packages/shared`) se arma comparando esas fotos y el plan.
- `lib/` — primitivos transversales: `guards.ts` (autorización), `pepper.ts`/`argon2.ts` (hashing), `rateLimit.ts`, `auditoria.ts` (`registrarAuditoria`, nunca lanza — un fallo de auditoría no debe romper el flujo que la origina), `planTratamiento.ts` (`revertirPlanDeVisita`: al eliminar/anular una atención, sus ítems del plan vuelven a pendiente), `imagen.ts` (valida imágenes por *magic bytes*, no por el MIME declarado por el cliente).
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

### PWA e instalación (ícono y modo sin conexión)

La web es instalable ("Agregar a pantalla de inicio") y la **agenda se puede consultar sin conexión** (solo lectura).

- **Ícono/manifest:** `web/public/icons/` tiene `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` e `icon-maskable-512.png`, todos con fondo blanco opaco (iOS pinta de negro lo transparente) y generados desde `functions/src/pdf/assets/luna-dental.png`. El manifest (`name` "Luna-Dental", `theme_color` `#1C5E5C`) se define en `web/vite.config.ts` y lo genera `vite-plugin-pwa`; las meta tags de iOS/Android están en `web/index.html`. Si cambia el logo, hay que regenerar los PNG a mano (no hay paso de build para eso).
- **Service worker:** `vite-plugin-pwa` (Workbox, `generateSW`, `registerType: 'prompt'`, `injectRegister: false`) precachea todo el build, incluidos los chunks lazy. Solo existe en el build (`npm run build` + `npm run preview --workspace=web`); **no corre en `vite dev`**. `navigateFallbackDenylist` excluye `/__/*` (rutas de auth de Firebase Hosting).
- **Datos offline:** `web/src/app/firebase.ts` inicializa Firestore con `persistentLocalCache` (IndexedDB, multi-pestaña). `usePrecargaAgenda` (`features/agenda/useAgenda.ts`, montado en `AppShell`) mantiene escuchando las citas de [hoy −7, hoy +30 días) para que queden en caché. Los hooks de la agenda no cambian: `onSnapshot` responde desde la caché sin red.
- **Sesión offline:** `AuthProvider` guarda `{uid, centroId, rol}` en `localStorage` (`cident.sesion`). Si `getIdTokenResult()` falla (sin red y token vencido) se usa esa copia, siempre que coincida el `uid`. Es solo para poder ver la caché; las reglas y callables siguen validando en el servidor cuando hay red.
- **Logout:** hace `terminate` + `clearIndexedDbPersistence` y recarga la página, para no dejar datos de pacientes en un dispositivo compartido.
- **UX:** `useEnLinea` (`lib/useEnLinea.ts`) muestra un banner "Sin conexión" en `AppShell` y deshabilita "Nueva cita" y "Guardar" en la agenda. Crear/editar citas, PDFs y cualquier callable requieren conexión.
- **Límites:** la caché solo contiene lo que el usuario ya consultó más la ventana precargada; fuera de ella la agenda aparece vacía. El registro lo hace `web/src/lib/actualizacionApp.ts` (llamado desde `main.tsx`): busca versión nueva con `registration.update()` al volver a la app (`visibilitychange`) y cada 30 min; si hay una, `AvisoActualizacion` (en `AppShell`) muestra «Actualizar» (no recarga sola para no perder lo que se escribe) y el portal `/p/:token` se actualiza sin preguntar; en el celular, para ver un ícono nuevo hay que borrar el acceso directo y volver a agregarlo.

### Despliegue

- `firebase deploy --only functions,hosting` procesa las functions **antes** de finalizar/activar (release) el hosting. Un error en una fase posterior a functions pero previa al release de hosting (p. ej. falla al configurar la cleanup policy de Artifact Registry en una región nueva) puede dejar los archivos de hosting subidos pero **sin activar**, sirviendo en silencio la versión anterior aunque el log de functions muestre todo en verde. Si el sitio no refleja un deploy "exitoso", desplegar hosting aislado (`firebase deploy --only hosting`) para confirmar que llega hasta "release complete", y comparar el hash de los assets de `web/dist` contra los que sirve la URL en vivo.
- `firebase.json` fija `Cache-Control: no-cache` solo para `index.html`, `sw.js`, `workbox-*.js`, `registerSW.js` y `manifest.webmanifest`, de modo que un deploy llega a los navegadores sin esperar. El resto de los archivos usa el `max-age=3600` por defecto de Hosting (los assets de Vite llevan hash, así que no es problema).
- Los assets de Vite (`web/dist/assets/*`) llevan hash de contenido en el nombre de archivo — sirven como señal de diagnóstico confiable para saber si lo que está en producción coincide con el build local.
