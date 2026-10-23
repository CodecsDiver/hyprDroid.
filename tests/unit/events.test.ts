import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EVENT_KINDS, parseEventRow, REACTIONS, sanitizePayload } from '@/domain/events'
import { MISCHIEF_EFFECTS } from '@/domain/mischief'
import { MOOD_KEYS } from '@/domain/moods'
import { SPELL_EFFECT_IDS } from '@/domain/spells'

const uuid = () => crypto.randomUUID()
const row = (overrides: Record<string, unknown> = {}) => ({
  id: uuid(), household_id: uuid(), sender_id: uuid(), recipient_id: uuid(), client_event_id: uuid(),
  kind: 'love_ping', payload: { reaction: 'heart' }, created_at: '2025-01-01T00:00:00Z', expires_at: '2025-01-08T00:00:00Z', seen_at: null,
  ...overrides,
})

describe('sanitizePayload', () => {
  it('keeps only known, validated fields', () => {
    expect(sanitizePayload('love_ping', { reaction: 'kiss', message: '  hi  ', evil: '<script>' })).toEqual({ reaction: 'kiss', message: 'hi' })
    expect(sanitizePayload('heart_tap', { anything: 1 })).toEqual({})
    expect(sanitizePayload('mischief', { effect: 'confetti', extra: 1 })).toEqual({ effect: 'confetti' })
  })

  it('rejects invalid input', () => {
    expect(() => sanitizePayload('love_ping', { reaction: 'nope' })).toThrow()
    expect(() => sanitizePayload('love_ping', { reaction: 'heart', message: 'x'.repeat(281) })).toThrow()
    expect(() => sanitizePayload('love_note', { body: '   ', voice: 'love' })).toThrow()
    expect(() => sanitizePayload('sticker', { sticker_id: 'nope' })).toThrow()
    expect(() => sanitizePayload('spell_cast', { effect: 'starfall', name: 'x', color: 'red' })).toThrow()
    expect(() => sanitizePayload('note_placed', { object_id: 'Bad Id', note_id: uuid() })).toThrow()
    expect(() => sanitizePayload('love_ping', null)).toThrow()
    expect(() => sanitizePayload('love_ping', [])).toThrow()
  })

  it('counts length in code points like Postgres, so emoji do not trip limits early', () => {
    expect(sanitizePayload('love_ping', { reaction: 'heart', message: '💗'.repeat(280) }).message).toHaveLength(560)
    expect(() => sanitizePayload('love_ping', { reaction: 'heart', message: '💗'.repeat(281) })).toThrow()
  })

  it('strips control characters', () => {
    expect(sanitizePayload('hug', { message: 'a\u0000b\u0007c' }).message).toBe('abc')
  })
})

describe('parseEventRow', () => {
  it('parses a well-formed row', () => {
    const parsed = parseEventRow(row())
    expect(parsed?.kind).toBe('love_ping')
    expect(parsed?.payload).toEqual({ reaction: 'heart' })
  })

  it.each([
    ['unknown kind', row({ kind: 'delete_all' })],
    ['bad id', row({ id: 'nope' })],
    ['bad timestamp', row({ created_at: 'yesterday-ish' })],
    ['hostile payload', row({ payload: { reaction: '<img onerror=x>' } })],
    ['not an object', 'a string'],
    ['null', null],
  ])('rejects %s', (_name, input) => {
    expect(parseEventRow(input)).toBeNull()
  })

  it('drops unexpected payload keys from incoming rows too', () => {
    const parsed = parseEventRow(row({ payload: { reaction: 'heart', html: '<b>x</b>' } }))
    expect(parsed?.payload).toEqual({ reaction: 'heart' })
  })
})

describe('client/database schema sync', () => {
  const sql = readdirSync(join(import.meta.dirname, '..', '..', 'supabase', 'migrations'))
    .sort()
    .map((file) => readFileSync(join(import.meta.dirname, '..', '..', 'supabase', 'migrations', file), 'utf8'))
    .join('\n')
  const arrayIn = (pattern: RegExp): string[] => {
    const match = pattern.exec(sql)
    if (!match) throw new Error(`pattern not found: ${pattern}`)
    return [...match[1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!)
  }

  it('event kinds match the events.kind CHECK constraint', () => {
    expect(arrayIn(/kind in \(([^)]*)\)\)/).sort()).toEqual([...EVENT_KINDS].sort())
  })
  it('reactions match the love_ping validator', () => {
    expect(arrayIn(/'reaction',\s*array\[([^\]]*)\]/).sort()).toEqual([...REACTIONS].sort())
  })
  it('mischief effects and their disruptive flags match', () => {
    expect(arrayIn(/mischief_effects\(\)[\s\S]*?array\[([^\]]*)\]/).sort()).toEqual(MISCHIEF_EFFECTS.map((e) => e.id).sort())
    const disruptiveSql = arrayIn(/mischief_is_disruptive[\s\S]*?array\[([^\]]*)\]/).sort()
    expect(disruptiveSql).toEqual(MISCHIEF_EFFECTS.filter((e) => e.disruptive).map((e) => e.id).sort())
  })
  it('spell effects match', () => {
    expect(arrayIn(/spell_effects\(\)[\s\S]*?array\[([^\]]*)\]/).sort()).toEqual([...SPELL_EFFECT_IDS].sort())
  })
  it('mood keys match', () => {
    expect(arrayIn(/mood_keys\(\)[\s\S]*?array\[([^\]]*)\]/).sort()).toEqual([...MOOD_KEYS].sort())
  })
})
