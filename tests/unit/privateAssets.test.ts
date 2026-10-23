import { describe, expect, it } from 'vitest'
import { buildUploadPlan, detectKind, extractDataUri, extractStringArray, looksLike, sha256, STICKER_SHEET } from '../../scripts/lib/privateAssets.mjs'

describe('extractStringArray', () => {
  it('reads string literals with escapes and mixed quotes, without evaluating anything', () => {
    const source = `const notes = [ 'You\\'re my favorite', "It's \\"fine\\"", 'a\\nb', 'smile \\u263A' ,
      'last one' ];\nconst other = ['x']`
    expect(extractStringArray(source, 'notes')).toEqual(["You're my favorite", `It's "fine"`, 'a\nb', 'smile ☺', 'last one'])
  })

  it('refuses code in an array rather than running it', () => {
    expect(() => extractStringArray(`const notes = [ alert(1) ]`, 'notes')).toThrow(/Unexpected character/)
    expect(() => extractStringArray('const notes = [ "open', 'notes')).toThrow(/Unterminated/)
    expect(() => extractStringArray('const nope = []', 'notes')).toThrow(/not found/)
  })

  it('handles an empty array', () => {
    expect(extractStringArray('const notes = []', 'notes')).toEqual([])
  })
})

describe('embedded asset extraction', () => {
  it('decodes data URIs and validates magic bytes', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
    const found = extractDataUri(`url('data:image/png;base64,${jpeg.toString('base64')}')`, 'image/')
    expect(found?.bytes.equals(jpeg)).toBe(true)
    expect(looksLike(found!.bytes, 'jpeg')).toBe(true)
    expect(looksLike(Buffer.from('not an image'), 'jpeg')).toBe(false)
    expect(looksLike(Buffer.from([0x49, 0x44, 0x33, 4]), 'mp3')).toBe(true)
    expect(extractDataUri('no data here', 'audio/')).toBeNull()
  })

  it('recognises the two originals by title', () => {
    expect(detectKind('<title>Signal Home Prototype - Phase 3A Signals</title>')).toBe('signal-home')
    expect(detectKind('<title>Our Little Love Universe</title>')).toBe('love-universe')
    expect(detectKind('<title>Something else</title>')).toBeNull()
  })
})

describe('upload plan', () => {
  const manifest = {
    files: {
      'time-capsule/signal-home.html': { sha256: sha256(Buffer.from('a')), bytes: 1 },
      'time-capsule/love-universe.html': { sha256: sha256(Buffer.from('b')), bytes: 1 },
      'assets/sticker-sheet.jpg': { sha256: sha256(Buffer.from('c')), bytes: 1 },
      'assets/room-song.mp3': { sha256: sha256(Buffer.from('d')), bytes: 1 },
    },
  }

  it('puts every file under the household path contract the database policies require', () => {
    const household = '11111111-2222-3333-4444-555555555555'
    const author = '99999999-8888-7777-6666-555555555555'
    const plan = buildUploadPlan({ household, author, manifest })
    expect(plan).toHaveLength(4)
    for (const step of plan) {
      expect(step.path.startsWith(`${household}/`)).toBe(true)
      // user-owned media must also sit in the author's own folder (storage + table CHECK constraints)
      if (step.type !== 'capsule') expect(step.path.startsWith(`${household}/${author}/`)).toBe(true)
    }
    expect(plan.filter((s) => s.type === 'capsule').every((s) => s.bucket === 'time-capsule' && s.contentType === 'text/html')).toBe(true)
  })

  it('describes 18 sticker cells in a 3 × 6 sheet', () => {
    expect(STICKER_SHEET.labels).toHaveLength(STICKER_SHEET.cols * STICKER_SHEET.rows)
  })
})
