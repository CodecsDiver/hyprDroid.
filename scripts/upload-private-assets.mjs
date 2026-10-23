#!/usr/bin/env node
/**
 * Loads the private content extracted by extract-source-assets.mjs into YOUR Supabase project:
 *   - the two original apps → private "time-capsule" bucket + immutable time_capsule_items rows
 *   - the sticker sheet     → private "stickers" bucket + 18 sticker rows (3 × 6 sprite cells)
 *   - the room song         → private "music" bucket + a track row
 *   - the written notes     → love_notes rows (authored by the person who wrote them)
 *
 * This runs on YOUR machine with the SERVICE-ROLE key. That key bypasses all security:
 * keep it in your shell environment only. It is never read by, or shipped in, the web app.
 *
 *   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
 *   node scripts/upload-private-assets.mjs --household <uuid> --author-email daniel@example.com [--dry-run] [--yes]
 *
 * Safe to re-run: existing items are skipped. An existing capsule item whose recorded
 * SHA-256 differs from the file on disk aborts the run (capsule items are immutable).
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { buildUploadPlan, sha256, STICKER_SHEET } from './lib/privateAssets.mjs'

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const value = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}

const dir = resolve(value('dir') ?? 'private')
const household = value('household')
const authorEmail = value('author-email')
const dryRun = flag('dry-run')

if (!household || !/^[0-9a-f-]{36}$/i.test(household) || !authorEmail) {
  console.error('Usage: node scripts/upload-private-assets.mjs --household <uuid> --author-email <email> [--dir private] [--dry-run] [--yes]')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
for (const [relative, entry] of Object.entries(manifest.files)) {
  const actual = sha256(readFileSync(join(dir, relative)))
  if (actual !== entry.sha256) throw new Error(`${relative} does not match manifest.json (was it modified?). Re-run the extract script.`)
}
const notes = JSON.parse(readFileSync(join(dir, 'seed/love-notes.json'), 'utf8'))

if (dryRun) {
  const plan = buildUploadPlan({ household, author: '<author-user-id>', manifest })
  console.log('DRY RUN — nothing will be uploaded. Plan:')
  for (const step of plan) console.log(`  ${step.type.padEnd(13)} ${step.bucket}/${step.path}  (${step.bytes} bytes, sha256 ${step.sha256.slice(0, 12)}…)`)
  console.log(`  love-notes    ${notes.love.length} love + ${notes.miss.length} miss-you notes → love_notes`)
  console.log(`  stickers      ${STICKER_SHEET.labels.length} sprite cells from the sheet`)
  process.exit(0)
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell (never in a .env that the web app reads).')
  process.exit(1)
}
if (!flag('yes')) {
  console.error(`About to write private content for household ${household} to ${new URL(url).host}.\nRe-run with --yes to proceed (or --dry-run to preview).`)
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

// Resolve the author and confirm they belong to the household.
let author = null
for (let page = 1; !author && page < 20; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
  if (error) throw new Error(`listing users: ${error.message}`)
  author = data.users.find((u) => u.email?.toLowerCase() === authorEmail.toLowerCase()) ?? null
  if (data.users.length < 100) break
}
if (!author) throw new Error(`No user with email ${authorEmail}`)
const member = must(await supabase.from('household_members').select('user_id').eq('household_id', household).eq('user_id', author.id).maybeSingle(), 'checking membership')
if (!member) throw new Error(`${authorEmail} is not a member of household ${household}`)

const plan = buildUploadPlan({ household, author: author.id, manifest })

async function upload(step) {
  const bytes = readFileSync(join(dir, step.source))
  const { error } = await supabase.storage.from(step.bucket).upload(step.path, bytes, { contentType: step.contentType, upsert: false })
  if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(`uploading ${step.path}: ${error.message}`)
  console.log(`  ${error ? 'exists  ' : 'uploaded'} ${step.bucket}/${step.path}`)
}

for (const step of plan) {
  if (step.type === 'capsule') {
    const existing = must(await supabase.from('time_capsule_items').select('sha256').eq('household_id', household).eq('slug', step.item.slug).maybeSingle(), 'reading capsule')
    if (existing && existing.sha256 !== step.sha256) throw new Error(`Capsule item ${step.item.slug} already exists with a DIFFERENT fingerprint. Capsule items are immutable; refusing to continue.`)
    await upload(step)
    if (!existing) {
      must(await supabase.from('time_capsule_items').insert({ household_id: household, slug: step.item.slug, title: step.item.title, description: step.item.description, storage_path: step.path, sha256: step.sha256, byte_size: step.bytes }), 'recording capsule item')
    }
  } else if (step.type === 'sticker-sheet') {
    await upload(step)
    const existing = must(await supabase.from('stickers').select('id').eq('household_id', household).eq('storage_path', step.path), 'reading stickers')
    if (existing.length === 0) {
      const rows = STICKER_SHEET.labels.map((label, index) => ({
        household_id: household, owner_id: author.id, label, storage_path: step.path,
        sprite_cols: STICKER_SHEET.cols, sprite_rows: STICKER_SHEET.rows, sprite_index: index,
      }))
      must(await supabase.from('stickers').insert(rows), 'inserting stickers')
      console.log(`  inserted ${rows.length} stickers`)
    }
  } else if (step.type === 'track') {
    await upload(step)
    const existing = must(await supabase.from('tracks').select('id').eq('household_id', household).eq('audio_path', step.path), 'reading tracks')
    if (existing.length === 0) {
      must(await supabase.from('tracks').insert({ household_id: household, owner_id: author.id, title: 'Room song', artist: 'From the original Signal Home', audio_path: step.path }), 'inserting track')
      console.log('  inserted track "Room song"')
    }
  }
}

const have = new Set(must(await supabase.from('love_notes').select('body').eq('household_id', household).eq('author_id', author.id), 'reading notes').map((row) => row.body))
const rows = [
  ...notes.love.map((body) => ({ household_id: household, author_id: author.id, voice: 'love', body })),
  ...notes.miss.map((body) => ({ household_id: household, author_id: author.id, voice: 'miss', body })),
].filter((row) => !have.has(row.body))
if (rows.length > 0) must(await supabase.from('love_notes').insert(rows), 'inserting notes')
console.log(`  ${rows.length} notes inserted (${have.size} already present)`)
console.log('Done.')
