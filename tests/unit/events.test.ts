import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EVENT_KINDS, parseEvent, REACTIONS, sanitizePayload } from '@/domain/events'

const uuid = () => crypto.randomUUID()
const row = (overrides: Record<string, unknown> = {}) => ({
  id: uuid(), senderId: 'daniel', recipientId: 'vee', clientEventId: uuid(),
  kind: 'love_ping', payload: { reaction: 'heart' }, createdAt: '2025-01-01T00:00:00Z', expiresAt: '2025-01-08T00:00:00Z', seenAt: null,
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

describe('parseEvent', () => {
  it('parses a well-formed row', () => {
    const parsed = parseEvent(row())
    expect(parsed?.kind).toBe('love_ping')
    expect(parsed?.payload).toEqual({ reaction: 'heart' })
  })

  it.each([
    ['unknown kind', row({ kind: 'delete_all' })],
    ['bad id', row({ id: 'nope' })],
    ['bad timestamp', row({ createdAt: 'yesterday-ish' })],
    ['hostile payload', row({ payload: { reaction: '<img onerror=x>' } })],
    ['not an object', 'a string'],
    ['null', null],
  ])('rejects %s', (_name, input) => {
    expect(parseEvent(input)).toBeNull()
  })

  it('drops unexpected payload keys from incoming rows too', () => {
    const parsed = parseEvent(row({ payload: { reaction: 'heart', html: '<b>x</b>' } }))
    expect(parsed?.payload).toEqual({ reaction: 'heart' })
  })
})

describe('server and client share one definition of events', () => {
  it('the server validates payloads with the very same sanitiser the client uses', async () => {
    const source = readFileSync(join(import.meta.dirname, '..', '..', 'server', 'routes', 'events.ts'), 'utf8')
    expect(source).toMatch(/from '\.\.\/\.\.\/src\/domain\/events'/)
    expect(source).toMatch(/sanitizePayload\(input\.kind/)
  })
  it('exposes every event kind', () => {
    expect(EVENT_KINDS).toContain('love_ping')
    expect(REACTIONS).toContain('custom')
  })
})
