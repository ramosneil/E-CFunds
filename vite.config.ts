import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Libraries go into their own long-lived files, so an app update only re-downloads the app code; icons stay in one
// file instead of dozens of tiny requests. jsPDF and the export code are not listed: they stay on-demand chunks.
const lib = (pkgs: string) => new RegExp(`[\\\\/]node_modules[\\\\/](${pkgs})[\\\\/]`);

// Which code this is: the git commit (Vercel and GitHub builds of the same commit get the same id), else "dev".
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'dev').slice(0, 12);

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    tailwindcss(),
    // Installable app (Phase 7). The service worker pre-caches the app's own files so it opens without a signal;
    // Supabase data is never cached (always live). New versions wait for the user's "Reload" (registerType prompt).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'E-CFunds — OMSC Student Organization Funds',
        short_name: 'E-CFunds',
        description: 'Fund monitoring for OMSC Mamburao student organizations and clubs.',
        lang: 'en-PH',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#13297A',
        background_color: '#F4F6FB',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // The PDF tools and report fonts are only needed for exports, which need a connection anyway.
        globIgnores: ['**/jspdf*', '**/html2canvas*', '**/purify*', '**/index.es-*', '**/fonts/**'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        importScripts: ['push-sw.js'],   // Web Push: show notifications + open the right page on tap (public/push-sw.js)
        runtimeCaching: [
          { // Google Fonts (UI text): keep a copy so the app looks right offline.
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: lib('react|react-dom|scheduler'), priority: 30 },
            { name: 'supabase', test: lib('@supabase'), priority: 20 },
            { name: 'app-libs', test: lib('@tanstack|react-router|cookie|set-cookie-parser|lucide-react'), priority: 10 },
          ],
        },
      },
    },
  },
});
