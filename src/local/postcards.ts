import { friendly } from '@/data/errors'
import { sanitizePayload, type EventKind } from '@/domain/events'

/**
 * Postcards carry a message from one copy of Signal Home to another, with no server in between: the sender copies a short
 * code (or a link) and hands it over however they like; the other copy turns it into an ordinary incoming message.
 * The code is plain text anyone could read or forge, so it can only ever say "heart / kiss / hug" style things: it is
 * validated by exactly the same rules as any other message, and importing the same code twice does nothing.
 */
export const POSTCARD_KINDS = ['love_ping', 'hug', 'heart_tap'] as const satisfies readonly EventKind[]
export type PostcardKind = (typeof POSTCARD_KINDS)[number]

const PREFIX = 'SH1.'
const MAX_AGE_MS = 30 * 24 * 3600 * 1000
const MAX_CODE_LENGTH = 4000

export interface Postcard {
  v: 1
  /** Becomes the message's idempotency key. */
  id: string
  /** The person who wrote it. */
  from: string
  kind: PostcardKind
  payload: Record<string, unknown>
  at: number
}

const toBase64Url = (text: string): string => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromBase64Url = (code: string): string => {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}

export function encodePostcard(card: Postcard): string {
  return PREFIX + toBase64Url(JSON.stringify(card))
}

export function createPostcard(input: { id: string; from: string; kind: PostcardKind; payload: unknown; now: number }): Postcard {
  if (!POSTCARD_KINDS.includes(input.kind)) throw friendly('That kind of message can not be sent as a postcard.')
  return { v: 1, id: input.id, from: input.from, kind: input.kind, payload: sanitizePayload(input.kind, input.payload) as Record<string, unknown>, at: input.now }
}

/** Accepts a bare code, or a whole link containing `#postcard=<code>`. Throws a message fit to show a person. */
export function decodePostcard(text: string, now: number): Postcard {
  const trimmed = text.trim()
  const code = trimmed.includes('#postcard=') ? trimmed.slice(trimmed.indexOf('#postcard=') + '#postcard='.length) : trimmed
  if (code.length > MAX_CODE_LENGTH || !code.startsWith(PREFIX)) throw friendly('That does not look like a postcard code.')
  let card: Partial<Postcard>
  try {
    card = JSON.parse(fromBase64Url(code.slice(PREFIX.length))) as Partial<Postcard>
  } catch {
    throw friendly('That postcard code is damaged. Copy it again, all of it.')
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (card.v !== 1 || typeof card.id !== 'string' || !uuid.test(card.id) || typeof card.from !== 'string' || typeof card.at !== 'number' || typeof card.kind !== 'string' || !POSTCARD_KINDS.includes(card.kind as PostcardKind)) {
    throw friendly('That postcard is not in a format this copy understands.')
  }
  if (now - card.at > MAX_AGE_MS) throw friendly('That postcard is more than 30 days old, so it has expired.')
  if (card.at - now > 24 * 3600 * 1000) throw friendly('That postcard says it was written in the future. Check this device’s clock.')
  const payload = sanitizePayload(card.kind as PostcardKind, card.payload ?? {}) as Record<string, unknown> // refuses anything the normal rules would
  return { v: 1, id: card.id, from: card.from, kind: card.kind as PostcardKind, payload, at: card.at }
}

export const postcardLink = (code: string, base: string): string => `${base.split('#')[0]}#postcard=${code}`
