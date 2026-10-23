#!/usr/bin/env node
/**
 * Puts the private content extracted by extract-source-assets.mjs into YOUR running app, through its own API:
 *   - the two original apps → the Time Capsule (immutable, integrity-checked)
 *   - the sticker sheet     → 18 stickers (3 × 6 sprite cells)
 *   - the room song         → a track in the music library
 *   - the written notes     → love notes, authored by the person you name
 *
 * It needs SIGNAL_ADMIN_TOKEN (printed by `npm run setup:auth`). That token lets this script act as either person,
 * so keep it in your shell only; it is never read by the web app.
 *
 *   SIGNAL_ADMIN_TOKEN=… node scripts/upload-private-assets.mjs --url https://your-site.netlify.app --author daniel [--dir private] [--dry-run]
 *   (for `npm run dev`: --url http://localhost:5173; the dev admin token is "dev-admin-token-" followed by the contents of .data/dev-secret, cut to 64 characters)
 *
 * Safe to re-run: items that already exist are skipped.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildUploadPlan, sha256, STICKER_SHEET } from './lib/privateAssets.mjs'

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const value = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}

const dir = resolve(value('dir') ?? 'private')
const base = (value('url') ?? process.env.SIGNAL_URL ?? '').replace(/\/$/, '')
const author = value('author')
const token = process.env.SIGNAL_ADMIN_TOKEN
const dryRun = flag('dry-run')

if (!author || (!dryRun && (!base || !token))) {
  console.error('Usage: SIGNAL_ADMIN_TOKEN=… node scripts/upload-private-assets.mjs --url <https://your-site> --author <user id, e.g. daniel> [--dir private] [--dry-run]')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
for (const [relative, entry] of Object.entries(manifest.files)) {
  const actual = sha256(readFileSync(join(dir, relative)))
  if (actual !== entry.sha256) throw new Error(`${relative} does not match manifest.json (was it modified?). Re-run the extract script.`)
}
const notes = JSON.parse(readFileSync(join(dir, 'seed/love-notes.json'), 'utf8'))
const plan = buildUploadPlan({ manifest })

if (dryRun) {
  console.log('DRY RUN — nothing will be uploaded. Plan:')
  for (const step of plan) console.log(`  ${step.type.padEnd(13)} ${step.source}  (${step.bytes} bytes, sha256 ${step.sha256.slice(0, 12)}…)`)
  console.log(`  love-notes    ${notes.love.length} love + ${notes.miss.length} miss-you notes`)
  console.log(`  stickers      ${STICKER_SHEET.labels.length} sprite cells from the sheet`)
  process.exit(0)
}

async function call(method, path, { body, bytes, headers = {} } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'x-admin-token': token, 'x-as-user': author, 'x-requested-with': 'signal-home', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    body: bytes ?? (body === undefined ? undefined : JSON.stringify(body)),
  })
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { /* not JSON */ }
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${data?.error?.code ?? text.slice(0, 120)}`)
  return data
}

async function uploadFile(step) {
  const bytes = readFileSync(join(dir, step.source))
  const start = await call('POST', '/files', { body: { kind: step.fileKind, mime: step.contentType, size: bytes.length } })
  for (let n = 0; n < start.chunks; n++) {
    await call('PUT', `/files/${start.id}/chunks/${n}`, { bytes: bytes.subarray(n * start.chunkSize, (n + 1) * start.chunkSize), headers: { 'content-type': 'application/octet-stream' } })
  }
  const meta = await call('POST', `/files/${start.id}/complete`)
  if (meta.sha256 !== step.sha256) throw new Error(`${step.source}: the server recorded a different fingerprint than the file on disk`)
  return meta.id
}

const status = await fetch(`${base}/api/status`).then((r) => r.json()).catch(() => null)
if (!status?.configured) throw new Error(`${base} is not reachable or not configured yet (open it in a browser to see what is missing).`)

const capsule = await call('GET', '/capsule')
const stickers = await call('GET', '/stickers')
const tracks = await call('GET', '/tracks')

for (const step of plan) {
  if (step.type === 'capsule') {
    if (capsule.some((item) => item.slug === step.item.slug && item.sha256 === step.sha256)) {
      console.log(`skip   capsule ${step.item.slug} (already archived)`)
      continue
    }
    const fileId = await uploadFile(step)
    await call('POST', '/capsule', { body: { slug: step.item.slug, title: step.item.title, description: step.item.description, fileId } })
    console.log(`added  capsule ${step.item.slug}`)
  } else if (step.type === 'sticker-sheet') {
    if (stickers.filter((s) => s.sprite).length >= STICKER_SHEET.labels.length) {
      console.log('skip   stickers (sheet already loaded)')
      continue
    }
    const fileId = await uploadFile(step)
    await call('POST', '/stickers/sheet', { body: { fileId, cols: STICKER_SHEET.cols, rows: STICKER_SHEET.rows, labels: STICKER_SHEET.labels } })
    console.log(`added  ${STICKER_SHEET.labels.length} stickers`)
  } else {
    if (tracks.some((track) => track.title === 'Room song')) {
      console.log('skip   room song (already in the library)')
      continue
    }
    const audioFileId = await uploadFile(step)
    await call('POST', '/tracks', { body: { title: 'Room song', artist: 'From the original Signal Home', audioFileId, coverFileId: null, durationMs: null } })
    console.log('added  room song')
  }
}

const all = [...notes.love.map((body) => ({ voice: 'love', body })), ...notes.miss.map((body) => ({ voice: 'miss', body }))]
const { added } = await call('POST', '/love-notes/bulk', { body: { notes: all } })
console.log(`added  ${added} love notes (${all.length - added} already existed)`)
