#!/usr/bin/env node
/**
 * Builds YOUR private copy: one HTML file that also contains your two original apps, the sticker sheet, the room song
 * and your written notes (from ./private, made by `npm run assets:extract`). Output: private/signal-home.html.
 *
 * That file is personal. It is written inside ./private, which git ignores; never publish it.
 */
import { copyFileSync, existsSync, rmSync } from 'node:fs'
import { build } from 'vite'

if (!existsSync('private/manifest.json')) {
  console.error('No ./private found. Run `npm run assets:extract -- <original-1.html> <original-2.html>` first.')
  process.exit(1)
}
process.env.SIGNAL_PRIVATE = '1'
await build({ build: { outDir: 'private/build', emptyOutDir: true } })
copyFileSync('private/build/index.html', 'private/signal-home.html')
rmSync('private/build', { recursive: true, force: true })
console.log('\nYour private copy: private/signal-home.html  (open it in a browser; do not publish it)')
