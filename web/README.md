# web — Luna-Dental

SPA en React + TypeScript + Vite (Tailwind, react-router, Firebase). Parte del monorepo; los comandos se corren desde la raíz (ver `CLAUDE.md`).

```bash
npm run dev                       # servidor de desarrollo (sin service worker)
npm run build                     # tsc -b && vite build (genera sw.js y manifest.webmanifest)
npm run preview --workspace=web   # sirve dist/ — aquí sí corre el service worker
npm run test:e2e --workspace=web  # Playwright (no usar `vitest` para e2e/)
```

## PWA y modo sin conexión

- Instalable en iOS/Android con el logo de Luna-Dental (`public/icons/`, manifest en `vite.config.ts`).
- La agenda se puede ver sin conexión (solo lectura): service worker de `vite-plugin-pwa` + caché persistente de Firestore + precarga de citas (−7/+30 días).
- Para probarlo: `npm run build`, `npm run preview --workspace=web`, iniciar sesión, abrir la agenda y luego DevTools › Network › Offline y recargar.
- Detalle de diseño y límites en la sección «PWA e instalación» de `CLAUDE.md`.
