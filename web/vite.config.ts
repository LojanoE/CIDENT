import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Candado: un build de producción jamás debe apuntar a los emuladores locales
  // (`.env.local` es de desarrollo; para producción va `.env.production.local`).
  if (mode === 'production' && loadEnv(mode, process.cwd(), '').VITE_USE_EMULATORS === 'true') {
    throw new Error(
      'Build de producción con VITE_USE_EMULATORS=true: crea web/.env.production.local con la config real de Firebase y VITE_USE_EMULATORS=false.',
    )
  }
  return {
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Luna-Dental',
        short_name: 'Luna-Dental',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1C5E5C',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        navigateFallback: '/index.html',
        // `/__/auth/*` y `/__/firebase/*` los sirve Firebase Hosting, no la app.
        navigateFallbackDenylist: [/^\/__\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  }
})
