import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Modes: `development` (dev server), `web` (PWA build, outputs dist-web), `tauri` (desktop bundle).
// Only the web and dev builds ship the PWA files and the Pyodide runtime from public/.
export default defineConfig(({ mode }) => ({
  base: './',
  publicDir: mode === 'tauri' ? false : 'public',
  plugins: [vue()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 4000, target: 'es2022' },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 60000 },
}))
