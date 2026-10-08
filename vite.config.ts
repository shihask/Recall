/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Precache only the Latin font subset; others still load on demand via unicode-range.
        globIgnores: ['**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese,latin-ext}-*.woff2'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png', 'theme-init.js'],
      manifest: {
        id: '/',
        name: 'Recall',
        short_name: 'Recall',
        description: 'Remember what you found. Your personal memory for the internet.',
        lang: 'en',
        theme_color: '#F7F7F5',
        background_color: '#F7F7F5',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/home',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Installed Recall appears in the Android share sheet (Chrome/Edge/Samsung
        // Internet). Not supported on iOS — the Save sheet's Paste button is the fallback.
        share_target: {
          action: '/save',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        shortcuts: [
          { name: 'Save something', short_name: 'Save', url: '/save', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Search', short_name: 'Search', url: '/search', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // Runtime-agnostic modules shared with the Edge Functions (one source of
      // truth for URL detection, categories, validation).
      '@shared': path.resolve(import.meta.dirname, './supabase/functions/_shared'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Stable vendor chunks: app updates don't invalidate cached libraries.
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'query', test: /node_modules[\\/]@tanstack[\\/]/ },
            { name: 'ui', test: /node_modules[\\/](@radix-ui|sonner|lucide-react)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/functions/_shared/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['supabase/functions/_shared/server/**'],
  },
})
