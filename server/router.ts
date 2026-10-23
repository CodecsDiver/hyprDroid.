import type { ServerConfig, ServerUser } from './config'
import type { Store } from './store'
import { ApiError, errorResponse, json, readBytes, readJson, SECURITY_HEADERS } from './http'

export interface Ctx {
  store: Store
  config: ServerConfig
  now: () => number
  uuid: () => string
  sleep: (ms: number) => Promise<void>
}

export interface Req {
  method: string
  url: URL
  params: Record<string, string>
  headers: Headers
  /** Signed-in user (or the user an admin acts as). */
  user: ServerUser
  admin: boolean
  ip: string
  request: Request
  json(): Promise<Record<string, unknown>>
  bytes(limit: number): Promise<Uint8Array>
}

export type Handler = (req: Req, ctx: Ctx) => Promise<unknown> | unknown

export type Auth = 'user' | 'admin' | 'none'

export interface Route {
  method: string
  pattern: string
  auth: Auth
  handler: Handler
  regex: RegExp
  keys: string[]
}

export class Router {
  readonly routes: Route[] = []

  private add(method: string, pattern: string, auth: Auth, handler: Handler): void {
    const keys: string[] = []
    const source = pattern.replace(/:([a-zA-Z]+)/g, (_m, key: string) => {
      keys.push(key)
      return '([^/]+)'
    })
    this.routes.push({ method, pattern, auth, handler, regex: new RegExp(`^${source}$`), keys })
  }

  get(pattern: string, handler: Handler, auth: Auth = 'user'): void {
    this.add('GET', pattern, auth, handler)
  }
  post(pattern: string, handler: Handler, auth: Auth = 'user'): void {
    this.add('POST', pattern, auth, handler)
  }
  put(pattern: string, handler: Handler, auth: Auth = 'user'): void {
    this.add('PUT', pattern, auth, handler)
  }
  patch(pattern: string, handler: Handler, auth: Auth = 'user'): void {
    this.add('PATCH', pattern, auth, handler)
  }
  delete(pattern: string, handler: Handler, auth: Auth = 'user'): void {
    this.add('DELETE', pattern, auth, handler)
  }

  match(method: string, path: string): { route: Route; params: Record<string, string> } | 'method' | null {
    let pathMatched = false
    for (const route of this.routes) {
      const m = route.regex.exec(path)
      if (!m) continue
      pathMatched = true
      if (route.method !== method) continue
      const params: Record<string, string> = {}
      route.keys.forEach((key, i) => (params[key] = decodeURIComponent(m[i + 1] ?? '')))
      return { route, params }
    }
    return pathMatched ? 'method' : null
  }
}

export { ApiError, errorResponse, json, readBytes, readJson, SECURITY_HEADERS }
