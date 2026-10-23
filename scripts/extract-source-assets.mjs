#!/usr/bin/env node
/**
 * Extracts everything PRIVATE out of the two original HTML apps into ./private/
 * (gitignored — this repository is public, so none of it may ever be committed).
 *
 *   node scripts/extract-source-assets.mjs <original.html> <original.html> [--out private]
 *
 * Produces:
 *   private/time-capsule/signal-home.html      byte-for-byte copies of the originals
 *   private/time-capsule/love-universe.html
 *   private/assets/sticker-sheet.jpg           embedded 3×6 sticker sheet (Love Universe)
 *   private/assets/room-song.mp3               embedded room song (Signal Home)
 *   private/seed/love-notes.json               the written love / miss-you notes
 *   private/manifest.json                      SHA-256 + size of every file
 */
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { detectKind, extractDataUri, extractStringArray, looksLike, sha256 } from './lib/privateAssets.mjs'

const args = process.argv.slice(2)
const outIndex = args.indexOf('--out')
const outDir = resolve(outIndex >= 0 ? (args.splice(outIndex, 2)[1] ?? 'private') : 'private')
const inputs = args.filter((arg) => !arg.startsWith('--'))
if (inputs.length !== 2) {
  console.error('Usage: node scripts/extract-source-assets.mjs <original-1.html> <original-2.html> [--out private]')
  process.exit(1)
}

const sources = {}
for (const file of inputs) {
  const bytes = readFileSync(file)
  const kind = detectKind(bytes.toString('utf8'))
  if (!kind) throw new Error(`${file}: not recognised as Signal Home or Love Universe (checked <title>)`)
  if (sources[kind]) throw new Error(`Two files look like "${kind}"`)
  sources[kind] = { file, bytes, text: bytes.toString('utf8') }
}
for (const kind of ['signal-home', 'love-universe']) if (!sources[kind]) throw new Error(`Missing the "${kind}" original`)

const files = {}
function write(relative, bytes) {
  const target = join(outDir, relative)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, bytes)
  files[relative] = { sha256: sha256(bytes), bytes: bytes.length }
  console.log(`  ${relative}  ${bytes.length} bytes  sha256 ${files[relative].sha256.slice(0, 12)}…`)
}

console.log(`Extracting into ${outDir}`)
for (const kind of ['signal-home', 'love-universe']) {
  const target = join(outDir, 'time-capsule', `${kind}.html`)
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(sources[kind].file, target) // byte-for-byte: never re-encoded or edited
  const bytes = readFileSync(target)
  if (sha256(bytes) !== sha256(sources[kind].bytes)) throw new Error('Copy does not match the original')
  files[`time-capsule/${kind}.html`] = { sha256: sha256(bytes), bytes: statSync(target).size }
  console.log(`  time-capsule/${kind}.html  ${bytes.length} bytes  sha256 ${files[`time-capsule/${kind}.html`].sha256.slice(0, 12)}…`)
}

const sheet = extractDataUri(sources['love-universe'].text, 'image/')
if (!sheet || !looksLike(sheet.bytes, 'jpeg')) throw new Error('Sticker sheet (embedded JPEG) not found in the Love Universe original')
write('assets/sticker-sheet.jpg', sheet.bytes)

const song = extractDataUri(sources['signal-home'].text, 'audio/')
if (!song || !looksLike(song.bytes, 'mp3')) throw new Error('Room song (embedded MP3) not found in the Signal Home original')
write('assets/room-song.mp3', song.bytes)

const notes = {
  love: extractStringArray(sources['love-universe'].text, 'notes'),
  miss: extractStringArray(sources['love-universe'].text, 'missYouNotes'),
}
write('seed/love-notes.json', Buffer.from(JSON.stringify(notes, null, 2) + '\n'))
console.log(`  ${notes.love.length} love notes, ${notes.miss.length} miss-you notes`)

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ version: 1, files }, null, 2) + '\n')
console.log('Done. Remember: private/ is gitignored. Do not commit or publish it.')
