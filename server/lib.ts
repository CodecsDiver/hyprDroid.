import type { ServerUser } from './config'
import { ApiError } from './http'
import type { Ctx } from './router'
import type { Store } from './store'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

export function uuidParam(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new ApiError(400, 'invalid_payload', field)
  return value.toLowerCase()
}

export function dateParam(value: unknown): string {
  if (typeof value !== 'string' || !DATE.test(value)) throw new ApiError(400, 'invalid_payload', 'date')
  return value
}

export const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
export const iso = (ms: number): string => new Date(ms).toISOString()
/** Zero-padded so keys sort chronologically. */
export const stamp = (ms: number): string => String(Math.floor(ms)).padStart(15, '0')

export function partnerOf(ctx: Ctx, user: ServerUser): ServerUser {
  const partner = ctx.config.users.find((u) => u.id !== user.id)
  if (!partner) throw new ApiError(409, 'no_partner')
  return partner
}

export async function getValue<T>(store: Store, key: string): Promise<T | null> {
  return (await store.get<T>(key))?.value ?? null
}

/** Reads every value under a prefix (small collections only). */
export async function listValues<T>(store: Store, prefix: string): Promise<T[]> {
  const keys = await store.list(prefix)
  const out: T[] = []
  for (const value of await Promise.all(keys.map((key) => getValue<T>(store, key)))) if (value !== null) out.push(value)
  return out
}

/**
 * Atomic read-modify-write with retries. `change` returns the new value, or `undefined` to leave things unchanged.
 * Returns the stored value (or the unchanged current one).
 */
export async function update<T>(store: Store, key: string, change: (current: T | null) => T | undefined, tries = 6): Promise<T | null> {
  for (let attempt = 0; attempt < tries; attempt++) {
    const entry = await store.get<T>(key)
    const next = change(entry?.value ?? null)
    if (next === undefined) return entry?.value ?? null
    const written = await store.put(key, next, entry ? { ifMatch: entry.etag } : { ifNew: true })
    if (written) return next
  }
  throw new ApiError(409, 'conflict')
}

export type Table =
  | 'moods' | 'garden_plants' | 'hidden_notes' | 'household_state' | 'listening_sessions' | 'listening_consent' | 'date_ideas'
  | 'love_notes' | 'stickers' | 'spell_recipes' | 'memories' | 'tracks' | 'playlists'

/** Tells the other device that a collection changed (its next sync returns immediately). */
export async function bump(ctx: Ctx, ...tables: Table[]): Promise<void> {
  const stampValue = `${ctx.now()}-${ctx.uuid().slice(0, 8)}`
  await update<Record<string, string>>(ctx.store, 'meta/versions', (current) => {
    const next = { ...(current ?? {}) }
    for (const table of tables) next[table] = stampValue
    return next
  })
}

export async function bumpPulse(ctx: Ctx, toUserId: string): Promise<void> {
  await update<Record<string, string>>(ctx.store, 'meta/versions', (current) => ({ ...(current ?? {}), [`pulse:${toUserId}`]: `${ctx.now()}-${ctx.uuid().slice(0, 8)}` }))
}

export function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ApiError(400, 'invalid_payload')
  return value as Record<string, unknown>
}

import { cleanText, ValidationError, type TextRules } from '../src/domain/validate'

/** Domain validation with failures mapped to a 400. */
export function clean(value: unknown, field: string, rules: TextRules): string {
  try {
    return cleanText(value, field, rules)
  } catch (error) {
    if (error instanceof ValidationError) throw new ApiError(400, 'invalid_payload', error.field)
    throw error
  }
}

/** Runs domain validation that throws ValidationError and maps it to a 400. */
export function validated<T>(work: () => T): T {
  try {
    return work()
  } catch (error) {
    if (error instanceof ValidationError) throw new ApiError(400, 'invalid_payload', error.field)
    throw error
  }
}
