#!/usr/bin/env node
/**
 * Serves ./dist and applies the rules in dist/_headers, so you can test the production build
 * with its real Content-Security-Policy (which `vite preview` does not apply).
 *
 *   node scripts/serve-dist.mjs [--port 4173] [--extra-origin http://127.0.0.1:54321]...
 *
 * --extra-origin widens connect/img/media-src for LOCAL TESTING against a non-Supabase origin.
 */
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'

const args = process.argv.slice(2)
const port = Number(args[args.indexOf('--port') + 1] || 4173)
const extras = args.flatMap((a, i) => (a === '--extra-origin' ? [args[i + 1]] : []))
const root = resolve('dist')

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' }

/** Parses the Netlify/Cloudflare `_headers` format into [{ pattern, headers }]. */
export function parseHeaders(text) {
  const rules = []
  let current = null
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue
    if (!/^\s/.test(raw)) {
      current = { pattern: raw.trim(), headers: {} }
      rules.push(current)
    } else if (current) {
      const i = raw.indexOf(':')
      current.headers[raw.slice(0, i).trim()] = raw.slice(i + 1).trim()
    }
  }
  return rules
}

export function matches(pattern, path) {
  if (pattern.endsWith('*')) return path.startsWith(pattern.slice(0, -1))
  return pattern === path
}

const rules = parseHeaders(readFileSync(join(root, '_headers'), 'utf8'))

function headersFor(path) {
  const merged = {}
  for (const rule of rules) if (matches(rule.pattern, path)) Object.assign(merged, rule.headers)
  if (extras.length && merged['Content-Security-Policy'] && path !== '/capsule-viewer.html') {
    merged['Content-Security-Policy'] = merged['Content-Security-Policy']
      .replace(/(connect-src[^;]*)/, `$1 ${extras.join(' ')} ${extras.map((e) => e.replace(/^http/, 'ws')).join(' ')}`)
      .replace(/(img-src[^;]*)/, `$1 ${extras.join(' ')}`)
      .replace(/(media-src[^;]*)/, `$1 ${extras.join(' ')}`)
  }
  return merged
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  let path = decodeURIComponent(url.pathname)
  let file = normalize(join(root, path))
  if (!file.startsWith(root)) {
    response.writeHead(403).end()
    return
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (path !== '/' && extname(path)) {
      response.writeHead(404).end('not found')
      return
    }
    path = '/'
    file = join(root, 'index.html')
  }
  response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', ...headersFor(path) })
  response.end(readFileSync(file))
}).listen(port, '127.0.0.1', () => console.log(`Serving dist with _headers on http://127.0.0.1:${port}`))
