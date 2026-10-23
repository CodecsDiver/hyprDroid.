import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vitest/config'
import { privateSeed, singleFileHtml } from './scripts/vite-plugins.mjs'

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

/**
 * The shared backend code (server/) was written for Node. In the browser build it runs inside the page, so the few
 * Node-only pieces it touches are swapped for browser versions. Tests run it on Node as-is, so nothing is swapped there.
 */
const inBrowser = !process.env.VITEST

export default defineConfig({
  plugins: [vue(), ...(inBrowser ? [privateSeed(), singleFileHtml(), viteSingleFile()] : [])],
  resolve: {
    alias: [
      { find: '@', replacement: here('./src') },
      ...(inBrowser
        ? [
            { find: /^node:crypto$/, replacement: here('./src/local/nodeCrypto.ts') },
            { find: /^(\.\.?\/)crypto$/, replacement: here('./src/local/crypto.ts') },
          ]
        : []),
    ],
  },
  build: { target: 'es2022', sourcemap: false, assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 4000 },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
