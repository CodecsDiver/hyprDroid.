import { verifyPassword, signToken } from '../crypto'
import { ApiError, json, SESSION_SECONDS, sessionCookie } from '../http'
import { getValue, partnerOf } from '../lib'
import type { Ctx, Router } from '../router'
import { requireObject } from '../lib'

const MAX_FAILURES = 8
const LOCK_MS = 15 * 60 * 1000

interface Failures {
  count: number
  lockedUntil: number
}

function isSecure(url: URL, headers: Headers): boolean {
  return url.protocol === 'https:' || headers.get('x-forwarded-proto') === 'https'
}

export function registerAuth(router: Router): void {
  router.get('/status', () => ({ configured: true }), 'none')

  router.post('/auth/login', async (req, ctx: Ctx) => {
    const body = requireObject(await req.json())
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!username || username.length > 64 || !password || password.length > 256) throw new ApiError(401, 'invalid_credentials')

    const user = ctx.config.users.find((u) => u.id === username) ?? null
    const failKey = `auth/failures/${user?.id ?? '_unknown'}`
    const failures = (await getValue<Failures>(ctx.store, failKey)) ?? { count: 0, lockedUntil: 0 }
    if (failures.lockedUntil > ctx.now()) throw new ApiError(429, 'locked', String(Math.ceil((failures.lockedUntil - ctx.now()) / 1000)))

    const ok = await verifyPassword(password, user?.passwordHash ?? null)
    if (!ok || !user) {
      // Unknown names share one counter so the lock does not reveal which names exist.
      const count = failures.count + 1
      await ctx.store.put(failKey, { count: count >= MAX_FAILURES ? 0 : count, lockedUntil: count >= MAX_FAILURES ? ctx.now() + LOCK_MS : 0 })
      throw new ApiError(401, 'invalid_credentials')
    }
    if (failures.count > 0) await ctx.store.remove(failKey)

    const token = signToken({ u: user.id, e: Math.floor(ctx.now() / 1000) + SESSION_SECONDS }, ctx.config.sessionSecret)
    const partner = partnerOf(ctx, user)
    return json(
      { user: { id: user.id, name: user.name }, partner: { id: partner.id, name: partner.name } },
      { headers: { 'set-cookie': sessionCookie(token, isSecure(req.url, req.headers)) } },
    )
  }, 'none')

  router.post('/auth/logout', (req) => json({ ok: true }, { headers: { 'set-cookie': sessionCookie('', isSecure(req.url, req.headers), 0) } }), 'none')

  router.get('/auth/me', (req, ctx) => {
    const partner = partnerOf(ctx, req.user)
    return { user: { id: req.user.id, name: req.user.name }, partner: { id: partner.id, name: partner.name } }
  })
}
