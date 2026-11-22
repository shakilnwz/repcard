import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'theme-init.js'],
      manifest: {
        name: 'GenForge Knowledgebase',
        short_name: 'GenForge KB',
        description: 'Offline-first cross-device knowledgebase for genforge-lab-knowledgebase',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0B132B',
        background_color: '#0B132B',
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        globPatterns: [
          'index.html',
          'theme-init.js',
          'icons/*.{png,svg}',
          'assets/index-*.{js,css}',
          'assets/workbox-window*.js',
          'assets/{MarkdownViewer,CanvasViewer,MarkdownEditor,GraphView,RadarWorkspace,ConflictModal,searchEngine,HighlightedCode,CodeViewer,ImageViewer,PdfViewer}-*.js',
          'assets/{useAppStore,jsx-runtime,rolldown-runtime,purify.es}-*.js',
          'assets/{copy,maximize-2,minimize-2,zoom-out}-*.js',
        ],
        runtimeCaching: [
          {
            urlPattern: ({ sameOrigin, url }) =>
              sameOrigin && /^\/assets\/.*\.(?:js|mjs|css)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'lazy-renderer-chunks-v1',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    globals: true,
    css: true,
  },
});
