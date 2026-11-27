/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig(({ command, isPreview, mode }) => ({
  plugins: [
    // Local HTTPS certificate for the dev server only. Builds and `vite preview` (used by the
    // E2E tests) don't need it, and in CI it would try to download mkcert.
    // Vitest also loads this config as `serve`, with mode 'test'; leave mkcert out there too.
    ...(command === 'serve' && !isPreview && mode !== 'test' ? [mkcert()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      devOptions: {
        enabled: true
      },
      // includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'It Always Picks You',
        short_name: 'It Picks You',
        description: 'The fair start-player app',
        theme_color: '#1e1f25',
        background_color: '#1e1f25',
        display: 'standalone',
        // `id` is the installed app's identity. Without it Chrome derives it from start_url,
        // which for existing installs is /index.html, so pin it to that: start_url can then
        // change without installs being treated as a different app.
        id: '/index.html',
        start_url: 'index.html',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          },
          // {
          //   src: 'icon-512-maskable.png',
          //   sizes: '512x512',
          //   type: 'image/png',
          //   purpose: 'maskable'
          // }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Only for link previews; installed apps never need it offline.
        globIgnores: ['og-image.png'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document' || request.destination === 'script' || request.destination === 'style' || request.destination === 'image' || request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'itpicksyou-assets-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 Days
              }
            }
          }
        ]
      }
    })
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
}));
