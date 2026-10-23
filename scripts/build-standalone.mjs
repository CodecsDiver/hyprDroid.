#!/usr/bin/env node
/** Bundles the Node server (server/standalone.ts) into one file: dist-server/standalone.mjs. Run `vite build` first. */
import { build } from 'esbuild'

await build({
  entryPoints: ['server/standalone.ts'],
  outfile: 'dist-server/standalone.mjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
})
console.log('Built dist-server/standalone.mjs. Start it with: npm start')
