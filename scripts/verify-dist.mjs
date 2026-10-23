#!/usr/bin/env node
/**
 * Post-build safety checks on ./dist. Fails the build if anything private or secret-shaped
 * would be published. Run by `npm run verify`.
 *
 *  1. No file in dist is byte-identical to anything in ./private (originals, sticker art, song).
 *  2. No audio files and no unexpected HTML pages are published.
 *  3. No service-role / secret keys or private-asset markers appear in any shipped file.
 *  4. The service worker, security headers and capsule viewer are present.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const dist = 'dist'
if (!existsSync(dist)) {
  console.error('dist/ not found. Run `vite build` first.')
  process.exit(1)
}

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? walk(path) : [path]
})
const files = walk(dist)
const problems = []
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')

// 1. Nothing private may be in dist, even renamed.
const privateHashes = new Set()
if (existsSync('private')) {
  for (const file of walk('private')) privateHashes.add(sha(readFileSync(file)))
}
for (const file of files) {
  if (privateHashes.has(sha(readFileSync(file)))) problems.push(`${relative(dist, file)} is identical to a file in ./private`)
}

// 2. Allowed HTML and no media.
const ALLOWED_HTML = new Set(['index.html', 'offline.html', 'capsule-viewer.html'])
for (const file of files) {
  const name = relative(dist, file)
  const ext = extname(file).toLowerCase()
  if (ext === '.html' && !ALLOWED_HTML.has(name)) problems.push(`unexpected HTML page in dist: ${name}`)
  if (['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.mp4', '.webm'].includes(ext)) problems.push(`audio/video file shipped publicly: ${name}`)
  if (statSync(file).size > 8 * 1024 * 1024) problems.push(`very large file (${Math.round(statSync(file).size / 1e6)} MB): ${name}`)
}

// 3. Secret-shaped strings.
const textLike = new Set(['.js', '.css', '.html', '.json', '.svg', '.webmanifest', '.map', '.txt'])
for (const file of files.filter((f) => textLike.has(extname(f).toLowerCase()) || f.endsWith('_headers'))) {
  const text = readFileSync(file, 'utf8')
  if (/service_role/.test(text) && !/never|must not|bypass|forbid/i.test(text)) problems.push(`${relative(dist, file)} mentions service_role outside a warning`)
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(text)) problems.push(`${relative(dist, file)} contains a Supabase secret key`)
  for (const jwt of text.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g) ?? []) {
    try {
      const role = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role
      if (role === 'service_role') problems.push(`${relative(dist, file)} contains a service-role JWT`)
    } catch { /* not a JWT */ }
  }
  if (/data:audio\/|data:video\//.test(text)) problems.push(`${relative(dist, file)} embeds audio/video as a data: URI`)
}

// 4. Required deliverables.
for (const required of ['sw.js', 'manifest.webmanifest', '_headers', 'capsule-viewer.html', 'capsule-viewer.js', 'offline.html', 'icons/icon-192.png', 'icons/icon-512.png']) {
  if (!existsSync(join(dist, required))) problems.push(`missing ${required}`)
}
const headers = existsSync(join(dist, '_headers')) ? readFileSync(join(dist, '_headers'), 'utf8') : ''
const mainCsp = /^\/\*\n\s+Content-Security-Policy: (.*)$/m.exec(headers)?.[1] ?? ''
if (!mainCsp) problems.push('no Content-Security-Policy for /*')
if (/script-src[^;]*'unsafe-(inline|eval)'/.test(mainCsp)) problems.push("main CSP allows unsafe script execution")

if (problems.length > 0) {
  console.error('dist verification FAILED:')
  for (const problem of problems) console.error(`  ✗ ${problem}`)
  process.exit(1)
}
console.log(`dist verification passed (${files.length} files checked${privateHashes.size ? `, compared against ${privateHashes.size} private files` : ', no ./private present to compare'}).`)
