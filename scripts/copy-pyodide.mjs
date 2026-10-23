// Copies the files Pyodide needs at runtime into public/pyodide so the PWA serves them itself
// (offline-capable, no CDN, no third-party requests).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(projectRoot, 'node_modules', 'pyodide')
const target = join(projectRoot, 'public', 'pyodide')
const files = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']

if (!existsSync(source)) {
  console.error('pyodide is not installed. Run `pnpm install` first.')
  process.exit(1)
}
mkdirSync(target, { recursive: true })
for (const file of files) copyFileSync(join(source, file), join(target, file))
console.log(`Copied ${files.length} Pyodide files to public/pyodide`)
