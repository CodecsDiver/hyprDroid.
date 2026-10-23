import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { CAPSULE_ITEMS, STICKER_SHEET } from './lib/privateAssets.mjs'

const VIRTUAL = 'virtual:private-seed'

/**
 * `virtual:private-seed`: the user's own original files, baked into the page ONLY when building with
 * SIGNAL_PRIVATE=1 (scripts/build-private.mjs). Every other build gets `null`, so a public build can never contain them.
 */
export function privateSeed() {
  return {
    name: 'signal-home-private-seed',
    resolveId: (id) => (id === VIRTUAL ? `\0${VIRTUAL}` : null),
    load(id) {
      if (id !== `\0${VIRTUAL}`) return null
      const dir = resolve('private')
      if (process.env.SIGNAL_PRIVATE !== '1' || !existsSync(join(dir, 'manifest.json'))) return 'export default null'
      const b64 = (relative) => (existsSync(join(dir, relative)) ? readFileSync(join(dir, relative)).toString('base64') : null)
      const notes = existsSync(join(dir, 'seed/love-notes.json')) ? JSON.parse(readFileSync(join(dir, 'seed/love-notes.json'), 'utf8')) : { love: [], miss: [] }
      const sheet = b64('assets/sticker-sheet.jpg')
      const song = b64('assets/room-song.mp3')
      const seed = {
        capsule: Object.values(CAPSULE_ITEMS).flatMap((item) => (b64(`time-capsule/${item.slug}.html`) ? [{ ...item, b64: b64(`time-capsule/${item.slug}.html`) }] : [])),
        stickerSheet: sheet ? { b64: sheet, cols: STICKER_SHEET.cols, rows: STICKER_SHEET.rows, labels: STICKER_SHEET.labels } : null,
        song: song ? { b64: song } : null,
        notes: [...notes.love.map((body) => ({ voice: 'love', body })), ...notes.miss.map((body) => ({ voice: 'miss', body }))],
      }
      return `export default ${JSON.stringify(seed)}`
    },
  }
}

/** Page tweaks for the single-file build: the icon is inlined (there is no second file to fetch). */
export function singleFileHtml() {
  return {
    name: 'signal-home-single-file-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const svg = readFileSync('src/assets/icon.svg', 'utf8').replace(/\s+/g, ' ').trim()
        return html.replace('<link rel="icon" href="data:," />', `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(svg)}" />`)
      },
    },
  }
}
