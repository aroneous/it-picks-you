/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig(({ command }) => ({
  plugins: [
    // Local HTTPS certificate for the dev server only; not needed (or wanted in CI) for builds.
    ...(command === 'serve' ? [mkcert()] : []),
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
