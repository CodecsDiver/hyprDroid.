import { EVENT_KINDS, isEventKind, sanitizePayload, type EventKind, type LoveEvent } from '../../src/domain/events'
import { mischiefEffect } from '../../src/domain/mischief'
import { ValidationError } from '../../src/domain/validate'
import type { UserSettings } from '../../src/shared/types'
import { DEFAULT_SETTINGS } from '../../src/shared/types'
import { ApiError } from '../http'
import { bump, bumpPulse, getValue, iso, listValues, partnerOf, requireObject, stamp, update, uuidParam } from '../lib'
import type { Ctx, Req, Router } from '../router'
import type { ServerUser } from '../config'

const RATE_LIMIT = 60
const DAILY_XP_CAP = 40
const DAY_MS = 86_400_000

const DEFAULT_TTL_S: Partial<Record<EventKind, number>> = {
  mischief: 3600, listening_invite: 3600, heart_tap: 86_400, note_placed: 2_592_000, love_note: 2_592_000,
}
const ttlFor = (kind: EventKind): number => DEFAULT_TTL_S[kind] ?? 604_800

function xpFor(event: Pick<LoveEvent, 'kind' | 'payload'>): number {
  switch (event.kind) {
    case 'love_ping': return ['heart', 'kiss', 'hug', 'comfort'].includes((event.payload as { reaction?: string }).reaction ?? '') ? 2 : 1
    case 'hug': case 'love_note': case 'spell_cast': case 'note_placed': return 2
    default: return 1
  }
}

const eventKey = (recipientId: string, event: Pick<LoveEvent, 'createdAt' | 'id'>): string => `events/${recipientId}/${stamp(Date.parse(event.createdAt))}-${event.id}`
const inboxKey = (recipientId: string, event: Pick<LoveEvent, 'createdAt' | 'id'>): string => `inbox/${recipientId}/${stamp(Date.parse(event.createdAt))}-${event.id}`

export async function getSettings(ctx: Ctx, userId: string): Promise<UserSettings> {
  return { ...DEFAULT_SETTINGS, ...((await getValue<Partial<UserSettings>>(ctx.store, `settings/${userId}`)) ?? {}) }
}

async function checkRate(ctx: Ctx, senderId: string): Promise<void> {
  let limited = false
  await update<{ at: number[] }>(ctx.store, `rate/${senderId}`, (current) => {
    const recent = (current?.at ?? []).filter((t) => ctx.now() - t < 60_000)
    if (recent.length >= RATE_LIMIT) {
      limited = true
      return undefined
    }
    return { at: [...recent, ctx.now()] }
  })
  if (limited) throw new ApiError(429, 'rate_limited')
}

async function addXp(ctx: Ctx, gain: number): Promise<void> {
  const today = new Date(ctx.now()).toISOString().slice(0, 10)
  await update<{ xp: number; day: string; today: number }>(ctx.store, 'state/bond', (current) => {
    const state = current ?? { xp: 0, day: today, today: 0 }
    const used = state.day === today ? state.today : 0
    const granted = Math.max(0, Math.min(gain, DAILY_XP_CAP - used))
    return { xp: state.xp + granted, day: today, today: used + granted }
  })
  await bump(ctx, 'household_state')
}

export interface EmitInput {
  sender: ServerUser
  recipient: ServerUser
  clientEventId: string
  kind: EventKind
  payload: unknown
  ttlSeconds?: number | null
}

/**
 * The one place events are created. Idempotent on (sender, clientEventId), crash-safe (the idempotency record
 * is written first and carries the whole event, so a retry completes a half-finished send), server-stamped,
 * rate-limited, consent-checked, payload-sanitised, and expiring.
 */
export async function emitEvent(ctx: Ctx, input: EmitInput): Promise<LoveEvent> {
  const idemKey = `idem/${input.sender.id}/${input.clientEventId}`
  let created = false
  let record = (await ctx.store.get<{ event: LoveEvent }>(idemKey))?.value ?? null

  if (!record) {
    await checkRate(ctx, input.sender.id)
    let payload: unknown
    try {
      payload = sanitizePayload(input.kind, input.payload)
    } catch (error) {
      if (error instanceof ValidationError) throw new ApiError(400, 'invalid_payload', error.field)
      throw error
    }
    if (input.kind === 'mischief') {
      const settings = await getSettings(ctx, input.recipient.id)
      const effect = mischiefEffect(String((payload as { effect?: string }).effect))
      if (!settings.allowMischief || !effect || (effect.disruptive && !settings.allowDisruptiveMischief)) throw new ApiError(403, 'recipient_declined')
    }
    const ttl = Math.max(10, Math.min(input.ttlSeconds ?? ttlFor(input.kind), 2_592_000))
    const event: LoveEvent = {
      id: ctx.uuid(), senderId: input.sender.id, recipientId: input.recipient.id, clientEventId: input.clientEventId,
      kind: input.kind, payload: payload as LoveEvent['payload'], createdAt: iso(ctx.now()), expiresAt: iso(ctx.now() + ttl * 1000), seenAt: null,
    }
    created = await ctx.store.put(idemKey, { event }, { ifNew: true })
    record = created ? { event } : ((await ctx.store.get<{ event: LoveEvent }>(idemKey))?.value ?? { event })
  }

  const event = record.event
  await ctx.store.put(eventKey(event.recipientId, event), event, { ifNew: true })
  await ctx.store.put(inboxKey(event.recipientId, event), event, { ifNew: true })
  if (created) await addXp(ctx, xpFor(event))
  return event
}

export async function unseenFor(ctx: Ctx, userId: string): Promise<LoveEvent[]> {
  const events = await listValues<LoveEvent>(ctx.store, `inbox/${userId}/`)
  const live: LoveEvent[] = []
  for (const event of events) {
    if (Date.parse(event.expiresAt) <= ctx.now()) await ctx.store.remove(inboxKey(userId, event))
    else live.push(event)
  }
  return live
}

export function registerEvents(router: Router): void {
  router.post('/events', async (req: Req, ctx: Ctx) => {
    const body = requireObject(await req.json())
    const kind = body.kind
    if (!isEventKind(kind) || kind === 'note_placed') throw new ApiError(400, 'invalid_kind')
    const ttl = body.ttlSeconds === null || body.ttlSeconds === undefined ? null : Number(body.ttlSeconds)
    if (ttl !== null && !Number.isFinite(ttl)) throw new ApiError(400, 'invalid_payload', 'ttlSeconds')
    return emitEvent(ctx, { sender: req.user, recipient: partnerOf(ctx, req.user), clientEventId: uuidParam(body.clientEventId, 'clientEventId'), kind, payload: body.payload ?? {}, ttlSeconds: ttl })
  })

  router.get('/events/unseen', (req, ctx) => unseenFor(ctx, req.user.id))

  router.post('/events/ack', async (req, ctx) => {
    const ids = requireObject(await req.json()).ids
    if (!Array.isArray(ids) || ids.length > 200) throw new ApiError(400, 'invalid_payload', 'ids')
    const wanted = new Set(ids.map((id) => uuidParam(id, 'ids')))
    let acknowledged = 0
    for (const key of await ctx.store.list(`inbox/${req.user.id}/`)) {
      if (!wanted.has(key.slice(-36))) continue // keys end with the event's uuid
      const event = await getValue<LoveEvent>(ctx.store, key)
      await ctx.store.remove(key)
      if (event) await ctx.store.put(eventKey(req.user.id, event), { ...event, seenAt: iso(ctx.now()) })
      acknowledged++
    }
    return { acknowledged }
  })

  router.get('/events/recent', async (req, ctx) => {
    const kinds = (req.url.searchParams.get('kinds') ?? '').split(',').filter(isEventKind)
    const limit = Math.min(Number(req.url.searchParams.get('limit') ?? '30') || 30, 60)
    const partner = partnerOf(ctx, req.user)
    const collect = async (userId: string): Promise<LoveEvent[]> => {
      const keys = (await ctx.store.list(`events/${userId}/`)).slice(-limit)
      return (await Promise.all(keys.map((key) => getValue<LoveEvent>(ctx.store, key)))).filter((e): e is LoveEvent => e !== null)
    }
    const all = [...(await collect(req.user.id)), ...(await collect(partner.id))]
    return all
      .filter((event) => Date.parse(event.expiresAt) > ctx.now() && (kinds.length === 0 || kinds.includes(event.kind)))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, limit)
  })

  router.get('/events/kinds', () => EVENT_KINDS)

  // ---- "I'm here" heart pulse (ephemeral)
  router.post('/pulse', async (req, ctx) => {
    await bumpPulse(ctx, partnerOf(ctx, req.user).id)
    return { ok: true }
  })
}

export { eventKey, inboxKey, xpFor }
