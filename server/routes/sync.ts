import type { Ctx, Router } from '../router'
import { getValue, partnerOf } from '../lib'
import { unseenFor } from './events'

const MAX_HOLD_S = 6
const CHECK_MS = 1500

function differs(known: Record<string, string>, current: Record<string, string>): boolean {
  return Object.keys(current).some((key) => known[key] !== current[key])
}

/**
 * Long-poll. Returns as soon as something is new for me (an event, a changed collection, a heart pulse) or
 * after `hold` seconds. The first call (no known versions) returns immediately so the client can load everything.
 */
export function registerSync(router: Router): void {
  router.get('/time', (_req, ctx) => ({ nowMs: ctx.now() }))

  router.get('/sync', async (req, ctx: Ctx) => {
    const partner = partnerOf(ctx, req.user)
    const params = req.url.searchParams
    const hold = Math.max(0, Math.min(Number(params.get('hold') ?? '0') || 0, MAX_HOLD_S))
    let known: Record<string, string> = {}
    let first = true
    try {
      const parsed = JSON.parse(params.get('v') ?? 'null') as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        known = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
        first = false
      }
    } catch {
      /* treated as a first call */
    }

    await ctx.store.put(`presence/${req.user.id}`, { at: ctx.now() })
    const startedAt = ctx.now()
    for (;;) {
      const events = await unseenFor(ctx, req.user.id)
      const versions = (await getValue<Record<string, string>>(ctx.store, 'meta/versions')) ?? {}
      const waited = ctx.now() - startedAt
      if (first || events.length > 0 || differs(known, versions) || waited >= hold * 1000) {
        const seen = await getValue<{ at: number }>(ctx.store, `presence/${partner.id}`)
        return { events, versions, partnerLastSeenMs: seen?.at ?? null, serverNowMs: ctx.now() }
      }
      await ctx.sleep(CHECK_MS)
    }
  })
}
