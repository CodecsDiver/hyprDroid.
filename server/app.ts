import { ValidationError } from '../src/domain/validate'
import type { ServerUser } from './config'
import { safeEqual, verifyToken } from './crypto'
import { ApiError, errorResponse, json, parseCookies, readBytes, readJson, SECURITY_HEADERS, SESSION_COOKIE } from './http'
import { Router, type Ctx, type Req, type Route } from './router'
import { registerAuth } from './routes/auth'
import { registerContent } from './routes/content'
import { registerEvents } from './routes/events'
import { registerFiles } from './routes/files'
import { registerKeepsakes } from './routes/keepsakes'
import { registerMedia } from './routes/media'
import { registerState } from './routes/state'
import { registerSync } from './routes/sync'

export function buildRouter(): Router {
  const router = new Router()
  registerAuth(router)
  registerEvents(router)
  registerSync(router)
  registerState(router)
  registerContent(router)
  registerFiles(router)
  registerMedia(router)
  registerKeepsakes(router)
  return router
}

/** All routes, for the client↔server contract test. */
export const ROUTES: readonly Pick<Route, 'method' | 'pattern' | 'auth'>[] = buildRouter().routes.map(({ method, pattern, auth }) => ({ method, pattern, auth }))

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Creates the request handler. Pure `Request` → `Response`, so it runs unchanged inside the page
 * (src/local) and on Node in tests.
 */
export function createApi(ctx: Ctx): (request: Request) => Promise<Response> {
  const router = buildRouter()

  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url)
    try {
      const path = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/'
      const match = router.match(request.method, path)
      if (match === null) throw new ApiError(404, 'not_found')
      if (match === 'method') throw new ApiError(405, 'method_not_allowed')
      const { route, params } = match

      // Cross-site request forgery: state-changing calls must carry a header a foreign page cannot send without CORS
      // (and the API sends no CORS headers), and must not be flagged cross-site by the browser.
      if (STATE_CHANGING.has(request.method)) {
        if (request.headers.get('x-requested-with') !== 'signal-home') throw new ApiError(403, 'csrf')
        const site = request.headers.get('sec-fetch-site')
        if (site && site !== 'same-origin' && site !== 'none') throw new ApiError(403, 'csrf')
      }

      let user: ServerUser | null = null
      let admin = false
      const adminHeader = request.headers.get('x-admin-token')
      if (adminHeader && ctx.config.adminToken && safeEqual(adminHeader, ctx.config.adminToken)) {
        admin = true
        const as = request.headers.get('x-as-user')?.toLowerCase()
        user = ctx.config.users.find((u) => u.id === as) ?? null
      } else {
        const token = parseCookies(request.headers.get('cookie'))[SESSION_COOKIE]
        const payload = token ? verifyToken(token, ctx.config.sessionSecret, ctx.now()) : null
        user = payload ? (ctx.config.users.find((u) => u.id === payload.u) ?? null) : null
      }

      if (route.auth === 'admin' && !admin) throw new ApiError(user ? 403 : 401, user ? 'permission' : 'not_authenticated')
      if (route.auth !== 'none' && !user) throw new ApiError(401, 'not_authenticated')

      const req: Req = {
        method: request.method, url, params, headers: request.headers, request,
        user: user as ServerUser, admin, ip: request.headers.get('x-nf-client-connection-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown',
        json: async () => (await readJson(request)) as Record<string, unknown>,
        bytes: (limit) => readBytes(request, limit),
      }
      const result = await route.handler(req, ctx)
      if (result instanceof Response) {
        for (const [name, value] of Object.entries(SECURITY_HEADERS)) if (!result.headers.has(name)) result.headers.set(name, value)
        return result
      }
      return json(result ?? { ok: true })
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error)
      if (error instanceof ValidationError) return errorResponse(new ApiError(400, 'invalid_payload', error.field))
      console.error('[api] unexpected error', error)
      return errorResponse(new ApiError(500, 'internal'))
    }
  }
}
