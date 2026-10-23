/**
 * Event kinds, payload schemas and parsing.
 *
 * `sanitizePayload` mirrors `private.sanitize_event_payload` in the database
 * (tests/unit/schema-sync.test.ts keeps the two in step). The client validates
 * before sending and again when receiving: the server is authoritative, but
 * incoming rows are never trusted blindly either.
 */

import { MISCHIEF_EFFECT_IDS, type MischiefEffectId } from './mischief'
import { SPELL_EFFECT_IDS, type SpellEffectId } from './spells'
import { cleanText, isHexColor, isRecord, isUuid, OBJECT_ID_PATTERN, pickEnum, ValidationError } from './validate'

export const EVENT_KINDS = [
  'love_ping', 'heart_tap', 'hug', 'sticker', 'love_note', 'note_placed', 'spell_cast', 'mischief', 'listening_invite',
] as const
export type EventKind = (typeof EVENT_KINDS)[number]

export const REACTIONS = ['heart', 'kiss', 'hug', 'miss_you', 'thinking_of_you', 'comfort', 'goodnight', 'safe', 'custom'] as const
export type Reaction = (typeof REACTIONS)[number]
export const REACTION_ANIMATIONS = ['float', 'burst', 'pulse', 'rain'] as const
export type ReactionAnimation = (typeof REACTION_ANIMATIONS)[number]

export interface EventPayloadMap {
  love_ping: { reaction: Reaction; label?: string; emoji?: string; message?: string; animation?: ReactionAnimation }
  heart_tap: Record<string, never>
  hug: { message?: string }
  sticker: { sticker_id: string }
  love_note: { body: string; voice: 'love' | 'miss' }
  note_placed: { object_id: string; note_id: string; open_when?: string }
  spell_cast: { effect: SpellEffectId; name: string; color?: string; message?: string }
  mischief: { effect: MischiefEffectId }
  listening_invite: { track_title?: string }
}

export interface LoveEvent<K extends EventKind = EventKind> {
  id: string
  senderId: string
  recipientId: string
  clientEventId: string
  kind: K
  payload: EventPayloadMap[K]
  createdAt: string
  expiresAt: string
  seenAt: string | null
}

function optional<T>(value: unknown, parse: (v: unknown) => T): T | undefined {
  return value === undefined || value === null ? undefined : parse(value)
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== '')) as T
}

export function sanitizePayload<K extends EventKind>(kind: K, raw: unknown): EventPayloadMap[K]
export function sanitizePayload(kind: EventKind, raw: unknown): EventPayloadMap[EventKind] {
  if (!isRecord(raw)) throw new ValidationError('payload', 'Payload must be an object')
  switch (kind) {
    case 'love_ping':
      return compact({
        reaction: pickEnum(raw.reaction, 'reaction', REACTIONS),
        label: cleanText(raw.label, 'label', { max: 24 }),
        emoji: cleanText(raw.emoji, 'emoji', { max: 16 }),
        message: cleanText(raw.message, 'message', { max: 280 }),
        animation: optional(raw.animation, (v) => pickEnum(v, 'animation', REACTION_ANIMATIONS)),
      })
    case 'heart_tap':
      return {}
    case 'hug':
      return compact({ message: cleanText(raw.message, 'message', { max: 280 }) })
    case 'sticker':
      if (!isUuid(raw.sticker_id)) throw new ValidationError('sticker_id', 'Unknown sticker')
      return { sticker_id: raw.sticker_id }
    case 'love_note':
      return { body: cleanText(raw.body, 'body', { max: 500, required: true }), voice: pickEnum(raw.voice, 'voice', ['love', 'miss'] as const) }
    case 'note_placed': {
      const objectId = cleanText(raw.object_id, 'object_id', { max: 63, required: true })
      if (!OBJECT_ID_PATTERN.test(objectId)) throw new ValidationError('object_id', 'Invalid object id')
      if (!isUuid(raw.note_id)) throw new ValidationError('note_id', 'Invalid note id')
      return compact({ object_id: objectId, note_id: raw.note_id, open_when: cleanText(raw.open_when, 'open_when', { max: 60 }) })
    }
    case 'spell_cast': {
      const color = optional(raw.color, (v) => {
        if (!isHexColor(v)) throw new ValidationError('color', 'Colour must look like #aabbcc')
        return v
      })
      return compact({
        effect: pickEnum(raw.effect, 'effect', SPELL_EFFECT_IDS),
        name: cleanText(raw.name, 'name', { max: 40, required: true }),
        color,
        message: cleanText(raw.message, 'message', { max: 140 }),
      })
    }
    case 'mischief':
      return { effect: pickEnum(raw.effect, 'effect', MISCHIEF_EFFECT_IDS) }
    case 'listening_invite':
      return compact({ track_title: cleanText(raw.track_title, 'track_title', { max: 120 }) })
  }
}

/** Parses an event received from the API into a LoveEvent, or returns null if it is malformed. */
export function parseEvent(row: unknown): LoveEvent | null {
  if (!isRecord(row)) return null
  const { id, senderId, recipientId, clientEventId, kind, payload, createdAt, expiresAt, seenAt } = row
  if (!isUuid(id) || !isUuid(clientEventId)) return null
  if (typeof senderId !== 'string' || typeof recipientId !== 'string' || !senderId || !recipientId) return null
  if (typeof kind !== 'string' || !(EVENT_KINDS as readonly string[]).includes(kind)) return null
  if (typeof createdAt !== 'string' || typeof expiresAt !== 'string') return null
  if (Number.isNaN(Date.parse(createdAt)) || Number.isNaN(Date.parse(expiresAt))) return null
  try {
    const eventKind = kind as EventKind
    return {
      id, senderId, recipientId, clientEventId, kind: eventKind,
      payload: sanitizePayload(eventKind, payload ?? {}), createdAt, expiresAt, seenAt: typeof seenAt === 'string' ? seenAt : null,
    }
  } catch {
    return null
  }
}

export function isExpired(event: Pick<LoveEvent, 'expiresAt'>, nowMs: number): boolean {
  return Date.parse(event.expiresAt) <= nowMs
}

export function isEventKind(value: unknown): value is EventKind {
  return typeof value === 'string' && (EVENT_KINDS as readonly string[]).includes(value)
}
