/**
 * Self-contained production server: serves ./dist and the API from one Node process, storing data in a folder.
 * Use it anywhere Node runs (a VPS, a Raspberry Pi, your own machine) — no Netlify, no database, no other service.
 *
 *   npm run build && npm run build:standalone && node dist-server/standalone.mjs
 *
 * Env: PORT (default 8080) · DATA_DIR (default ./data) · SIGNAL_USERS / SIGNAL_SESSION_SECRET (see `npm run setup:auth`).
 */
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { devConfig } from './config'
import { matchesPattern, parseHeadersFile } from './headers-file'
import { respond } from './node-adapter'
import { createHandler } from './runtime'
import { purgeExpired } from './purge'
import { FileStore } from './store'

const port = Number(process.env.PORT ?? 8080)
const dataDir = resolve(process.env.DATA_DIR ?? 'data')
const root = resolve(process.env.DIST_DIR ?? 'dist')
mkdirSync(dataDir, { recursive: true })

const secretFile = join(dataDir, 'dev-secret')
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'), { mode: 0o600 })

const store = new FileStore(join(dataDir, 'store'))
const handler = await createHandler({ env: process.env, store, devFallback: () => devConfig(readFileSync(secretFile, 'utf8').trim()) })
const rules = existsSync(join(root, '_headers')) ? parseHeadersFile(readFileSync(join(root, '_headers'), 'utf8')) : []

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2',
}

function headersFor(path: string): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const rule of rules) if (matchesPattern(rule.pattern, path)) Object.assign(merged, rule.headers)
  return merged
}

setInterval(() => void purgeExpired(store, Date.now()).catch((error) => console.error('[purge]', error)), 3_600_000).unref()

createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return respond(handler, req, res)
    let path = decodeURIComponent(url.pathname)
    let file = normalize(join(root, path))
    if (!file.startsWith(root)) {
      res.writeHead(403).end()
      return
    }
    if (!existsSync(file) || statSync(file).isDirectory()) {
      if (path !== '/' && extname(path)) {
        res.writeHead(404).end('not found')
        return
      }
      path = '/'
      file = join(root, 'index.html')
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', ...headersFor(path) })
    res.end(readFileSync(file))
  })().catch((error) => {
    console.error('[server]', error)
    if (!res.headersSent) res.writeHead(500)
    res.end()
  })
}).listen(port, () => console.log(`Signal Home on http://localhost:${port}  (data: ${dataDir})`))
