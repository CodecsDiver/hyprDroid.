import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'node:fs'

const appVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version as string

// Modes: `development` (dev server), `web` (PWA build, outputs dist-web), `tauri` (desktop bundle).
// Only the web and dev builds ship the PWA files and the Pyodide runtime from public/.
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  publicDir: mode === 'tauri' ? false : 'public',
  plugins: [vue()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 4000, target: 'es2022' },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 60000 },
}))
