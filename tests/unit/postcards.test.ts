import { describe, expect, it } from 'vitest'
import { createPostcard, decodePostcard, encodePostcard, postcardLink } from '@/local/postcards'

const NOW = Date.parse('2025-06-01T12:00:00Z')
const ID = '11111111-2222-4333-8444-555555555555'
const make = (over: Record<string, unknown> = {}) => createPostcard({ id: ID, from: 'daniel', kind: 'love_ping', payload: { reaction: 'kiss', message: 'hi' }, now: NOW, ...over } as never)

describe('postcards', () => {
  it('round-trips a card through its code and through a link', () => {
    const code = encodePostcard(make())
    expect(code.startsWith('SH1.')).toBe(true)
    expect(decodePostcard(code, NOW + 1000)).toMatchObject({ id: ID, from: 'daniel', kind: 'love_ping', payload: { reaction: 'kiss', message: 'hi' } })
    expect(decodePostcard(`  ${postcardLink(code, 'file:///home/me/signal-home.html#old')}  `, NOW).id).toBe(ID)
  })

  it('survives non-ASCII messages', () => {
    const code = encodePostcard(make({ payload: { reaction: 'heart', message: 'te quiero — 💗 ありがとう' } }))
    expect(decodePostcard(code, NOW).payload).toMatchObject({ message: 'te quiero — 💗 ありがとう' })
  })

  it('refuses things that are not postcards, damaged codes and unknown formats', () => {
    expect(() => decodePostcard('hello', NOW)).toThrow(/does not look like/)
    expect(() => decodePostcard('SH1.%%%', NOW)).toThrow(/damaged/)
    const forged = 'SH1.' + btoa(JSON.stringify({ v: 2, id: ID, from: 'daniel', kind: 'love_ping', payload: {}, at: NOW }))
    expect(() => decodePostcard(forged, NOW)).toThrow(/format/)
    expect(() => decodePostcard('SH1.' + 'A'.repeat(5000), NOW)).toThrow(/does not look like/)
  })

  it('refuses kinds that must never travel as text (mischief, spells, notes)', () => {
    expect(() => createPostcard({ id: ID, from: 'daniel', kind: 'mischief' as never, payload: { effect: 'confetti' }, now: NOW })).toThrow()
    const forged = 'SH1.' + btoa(JSON.stringify({ v: 1, id: ID, from: 'daniel', kind: 'mischief', payload: { effect: 'shake_room' }, at: NOW }))
    expect(() => decodePostcard(forged, NOW)).toThrow(/format/)
  })

  it('applies the normal payload rules: bad payloads are refused, unknown keys dropped', () => {
    const bad = 'SH1.' + btoa(JSON.stringify({ v: 1, id: ID, from: 'daniel', kind: 'love_ping', payload: { reaction: 'nonsense' }, at: NOW }))
    expect(() => decodePostcard(bad, NOW)).toThrow()
    const extra = 'SH1.' + btoa(JSON.stringify({ v: 1, id: ID, from: 'daniel', kind: 'love_ping', payload: { reaction: 'heart', evil: '<script>' }, at: NOW }))
    expect(JSON.stringify(decodePostcard(extra, NOW).payload)).not.toContain('evil')
  })

  it('expires after 30 days and rejects cards from the future', () => {
    const code = encodePostcard(make())
    expect(() => decodePostcard(code, NOW + 31 * 86_400_000)).toThrow(/expired/)
    expect(decodePostcard(code, NOW + 29 * 86_400_000).id).toBe(ID)
    expect(() => decodePostcard(code, NOW - 3 * 86_400_000)).toThrow(/future/)
  })
})
