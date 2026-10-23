// Pure helpers shared by the extract/upload scripts and unit tests. No I/O here.
import { createHash } from 'node:crypto'

export const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

/**
 * Parses a JavaScript array of string literals that follows `const <name> = [` in source text.
 * Handles single/double quotes and the common escapes. It never evaluates the source.
 */
export function extractStringArray(source, name) {
  const start = new RegExp(`const\\s+${name}\\s*=\\s*\\[`).exec(source)
  if (!start) throw new Error(`Array "${name}" not found`)
  let i = start.index + start[0].length
  const items = []
  for (;;) {
    while (i < source.length && /[\s,]/.test(source[i])) i++
    if (source[i] === ']') return items
    const quote = source[i]
    if (quote !== "'" && quote !== '"') throw new Error(`Unexpected character "${source[i]}" in array "${name}" at ${i}`)
    i++
    let text = ''
    while (i < source.length && source[i] !== quote) {
      if (source[i] === '\\') {
        const next = source[i + 1]
        if (next === 'n') text += '\n'
        else if (next === 't') text += '\t'
        else if (next === 'u') {
          text += String.fromCharCode(parseInt(source.slice(i + 2, i + 6), 16))
          i += 4
        } else text += next
        i += 2
      } else text += source[i++]
    }
    if (i >= source.length) throw new Error(`Unterminated string in array "${name}"`)
    i++ // closing quote
    items.push(text)
  }
}

/** Decodes the first `data:<mime>;base64,` payload matching `mimePrefix`. Returns { mime, bytes } or null. */
export function extractDataUri(source, mimePrefix) {
  const match = new RegExp(`data:(${mimePrefix.replace('/', '\\/')}[a-z0-9.+-]*);base64,([A-Za-z0-9+/=]+)`).exec(source)
  return match ? { mime: match[1], bytes: Buffer.from(match[2], 'base64') } : null
}

export function detectKind(html) {
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? ''
  if (/signal home/i.test(title)) return 'signal-home'
  if (/love universe/i.test(title)) return 'love-universe'
  return null
}

export function looksLike(bytes, kind) {
  if (kind === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (kind === 'mp3') return (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  return false
}

/** Accessible names for the 18 stickers of the original 3 × 6 sheet, in reading order. */
export const STICKER_SHEET = {
  cols: 3,
  rows: 6,
  labels: [
    'Good morning!', 'Whattt?', 'Huh?', "I'm reminding you!", 'So sleepy', 'Wow!', 'Approved!', 'Nice!', 'Hey you!',
    'Achoo!', 'Angry!', 'Huh???', 'Good night :3', 'Too cuteee', 'Am I cool yet?!', 'Nom nom!', 'Hmm...', 'Hehe',
  ],
}

export const CAPSULE_ITEMS = {
  'signal-home': { slug: 'signal-home', title: 'Signal Home (original)', description: 'The original interactive room, exactly as it was archived.' },
  'love-universe': { slug: 'love-universe', title: 'Our Little Love Universe (original)', description: 'The original interactive heart, exactly as it was archived.' },
}

/** Builds the deterministic upload plan; the upload script executes it (or prints it for --dry-run). */
export function buildUploadPlan({ household, author, manifest }) {
  const plan = []
  for (const kind of ['signal-home', 'love-universe']) {
    const entry = manifest.files[`time-capsule/${kind}.html`]
    if (!entry) continue
    plan.push({ type: 'capsule', bucket: 'time-capsule', path: `${household}/${kind}.html`, source: `time-capsule/${kind}.html`, contentType: 'text/html', sha256: entry.sha256, bytes: entry.bytes, item: CAPSULE_ITEMS[kind] })
  }
  const sheet = manifest.files['assets/sticker-sheet.jpg']
  if (sheet) {
    plan.push({ type: 'sticker-sheet', bucket: 'stickers', path: `${household}/${author}/sticker-sheet.jpg`, source: 'assets/sticker-sheet.jpg', contentType: 'image/jpeg', sha256: sheet.sha256, bytes: sheet.bytes })
  }
  const song = manifest.files['assets/room-song.mp3']
  if (song) {
    plan.push({ type: 'track', bucket: 'music', path: `${household}/${author}/room-song.mp3`, source: 'assets/room-song.mp3', contentType: 'audio/mpeg', sha256: song.sha256, bytes: song.bytes })
  }
  return plan
}
