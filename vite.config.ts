import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * The full Material Symbols variable font is ~5.4 MB. Google Fonts can subset it to just the
 * glyphs we use (`icon_names`, sorted) — about 6 KB. The list is read from MaterialIcons.tsx,
 * so adding an icon there is all it takes; nothing to keep in sync by hand.
 */
function materialSymbolsSubset(): Plugin {
  const iconsFile = fileURLToPath(new URL('./src/components/ui/MaterialIcons.tsx', import.meta.url))
  return {
    name: 'material-symbols-subset',
    transformIndexHtml(html) {
      const source = readFileSync(iconsFile, 'utf8')
      const names = [...new Set([...source.matchAll(/name="([a-z0-9_]+)"/g)].map((m) => m[1]))].sort()
      if (names.length === 0) throw new Error('[material-symbols-subset] no icon names found in MaterialIcons.tsx')
      return html.replace('__MATERIAL_SYMBOL_NAMES__', names.join(','))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    materialSymbolsSubset(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'SysDesign & AI Flashcards',
        short_name: 'RepCard',
        description: 'Distraction-free System Design & AI spaced repetition flashcards',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
