import { describe, expect, it } from 'vitest'
import { decodeBackup, encodeBackup } from '@/local/backup'

const bytes = (n: number, seed = 1): Uint8Array => Uint8Array.from({ length: n }, (_, i) => (i * seed + 3) & 0xff)
const read = (blob: Blob): Promise<string> => blob.text()

describe('backups', () => {
  it('round-trips records and files exactly, including large binary files', async () => {
    const entries = new Map<string, Uint8Array>([
      ['notes/abc', new TextEncoder().encode('{"body":"héllo 💗"}')],
      ['chunks/f/0000', bytes(3 * 1024 * 1024 + 17, 7)],
      ['empty/x', new Uint8Array()],
    ])
    const decoded = decodeBackup(await read(encodeBackup(entries, new Date('2025-06-01T00:00:00Z'))))
    expect(decoded.createdAt).toBe('2025-06-01T00:00:00.000Z')
    expect([...decoded.entries.keys()].sort()).toEqual([...entries.keys()].sort())
    for (const [key, value] of entries) expect(Buffer.from(decoded.entries.get(key)!).equals(Buffer.from(value))).toBe(true)
  })

  it('leaves out who-is-here information', async () => {
    const text = await read(encodeBackup(new Map([['presence/vee', bytes(5)], ['moods/vee', bytes(5)]])))
    expect(Object.keys(JSON.parse(text).entries)).toEqual(['moods/vee'])
  })

  it('refuses files that are not backups, or are damaged, before anything is applied', () => {
    expect(() => decodeBackup('not json')).toThrow(/not readable/)
    expect(() => decodeBackup('{"app":"other","version":1,"entries":{}}')).toThrow(/not a Signal Home backup/)
    expect(() => decodeBackup('{"app":"signal-home","version":99,"entries":{}}')).toThrow(/different version/)
    expect(() => decodeBackup('{"app":"signal-home","version":1}')).toThrow(/damaged/)
    expect(() => decodeBackup('{"app":"signal-home","version":1,"entries":{"a/b":5}}')).toThrow(/damaged/)
    expect(() => decodeBackup('{"app":"signal-home","version":1,"entries":{"a/b":"***"}}')).toThrow(/damaged/)
  })

  it('refuses records this app would never write (path tricks)', () => {
    for (const key of ['../escape', '/abs', 'a//b', 'a/./b', 'a\\\\b']) {
      expect(() => decodeBackup(JSON.stringify({ app: 'signal-home', version: 1, entries: { [key]: 'AAAA' } })), key).toThrow(/never write/)
    }
  })

  it('ignores presence records even if a file contains them', () => {
    const file = JSON.stringify({ app: 'signal-home', version: 1, entries: { 'presence/vee': 'AAAA', 'moods/vee': 'AAAA' } })
    expect([...decodeBackup(file).entries.keys()]).toEqual(['moods/vee'])
  })
})
