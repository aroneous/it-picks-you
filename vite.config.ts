//import { resolve } from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import mkcert from'vite-plugin-mkcert';

export default defineConfig({
  //root: resolve(__dirname, 'public'),
  plugins: [
    mkcert(),
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
        theme_color: '#000000',
        background_color: '#000000',
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
              cacheName: 'itchoosesyou-assets-cache',
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
  // server: {
  //   https: true // Enable HTTPS
  // }
});
