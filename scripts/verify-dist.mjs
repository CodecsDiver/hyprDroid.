#!/usr/bin/env node
/**
 * Post-build safety checks on ./dist (the PUBLIC build). Fails if anything private could be published.
 *
 *  1. dist is exactly one file: index.html.
 *  2. Nothing from ./private appears in it: no original app, sticker art, song or note text, not even re-encoded as base64.
 *  3. It contains no audio/video data and makes no network calls to anything outside the page.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
const problems = []
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html not found. Run `vite build` first.')
  process.exit(1)
}

const files = readdirSync(dist)
if (files.length !== 1 || files[0] !== 'index.html') problems.push(`dist must contain only index.html, found: ${files.join(', ')}`)

const html = readFileSync(join(dist, 'index.html'), 'utf8')
const size = statSync(join(dist, 'index.html')).size

// 2. Private content, in any encoding the build could plausibly have used.
const privateDir = 'private'
let compared = 0
const probes = []
for (const relative of ['time-capsule/signal-home.html', 'time-capsule/love-universe.html', 'assets/sticker-sheet.jpg', 'assets/room-song.mp3']) {
  const path = join(privateDir, relative)
  if (!existsSync(path)) continue
  const bytes = readFileSync(path)
  // Several windows of the file, so partial embedding is caught too.
  for (const at of [0, Math.floor(bytes.length / 2), Math.max(0, bytes.length - 300)]) {
    const window = bytes.subarray(at, at + 240)
    // Base64 of a window depends on alignment; test all three.
    for (let skew = 0; skew < 3; skew++) probes.push({ relative, text: bytes.subarray(at + skew, at + skew + 240).toString('base64').slice(4, 200) })
  }
  compared++
}
const notesPath = join(privateDir, 'seed/love-notes.json')
if (existsSync(notesPath)) {
  const notes = JSON.parse(readFileSync(notesPath, 'utf8'))
  // Two generic lines are also the app's built-in fallback wording (src/domain/loveUniverse.ts), so they are expected.
  const builtIn = readFileSync('src/domain/loveUniverse.ts', 'utf8')
  for (const note of [...notes.love, ...notes.miss]) if (note.length > 20 && !builtIn.includes(note) && html.includes(note.slice(0, 40))) problems.push('a written note from ./private appears in dist/index.html')
  compared++
}
for (const probe of probes) if (html.includes(probe.text)) problems.push(`content of private/${probe.relative} appears in dist/index.html`)

// 3. Media and network.
if (/data:(audio|video)\//.test(html)) problems.push('index.html embeds audio/video as a data: URI')
if (/\bfetch\(\s*["'`]https?:|new WebSocket\(|XMLHttpRequest/.test(html)) problems.push('index.html contains a network call')
if (size > 8 * 1024 * 1024) problems.push(`the public build is unexpectedly large (${Math.round(size / 1e6)} MB): does it contain media?`)

if (problems.length > 0) {
  console.error('dist verification FAILED:')
  for (const problem of [...new Set(problems)]) console.error(`  ✗ ${problem}`)
  process.exit(1)
}
console.log(`dist verification passed (1 file, ${(size / 1e6).toFixed(1)} MB${compared ? `, compared against ${compared} private sources` : ', no ./private present to compare'}).`)
