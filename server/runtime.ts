import { randomUUID } from 'node:crypto'
import { createApi } from './app'
import { loadConfig, type ServerConfig } from './config'
import { errorResponse, json, ApiError } from './http'
import type { Store } from './store'

export interface RuntimeOptions {
  env: Record<string, string | undefined>
  store: Store
  /** Used only outside production when the SIGNAL_* variables are absent (two users, password "dev"). */
  devFallback?: () => Promise<ServerConfig>
  sleep?: (ms: number) => Promise<void>
}

/**
 * Builds the request handler from the environment. When the server is not configured it still answers
 * `/api/status` (so the app can tell the owner what is missing) and refuses everything else.
 */
export async function createHandler(options: RuntimeOptions): Promise<(request: Request) => Promise<Response>> {
  const result = loadConfig(options.env)
  let config: ServerConfig | null = result.ok ? result.config : null
  let note: string | null = null
  if (!config && options.devFallback && options.env.NODE_ENV !== 'production') {
    config = await options.devFallback()
    note = 'Development mode: using built-in users "daniel" and "vee" with the password "dev".'
  }

  if (!config) {
    const problems = result.ok ? [] : result.problems
    return async (request) => {
      const path = new URL(request.url).pathname.replace(/^\/api/, '')
      if (path === '/status') return json({ configured: false, problems })
      return errorResponse(new ApiError(503, 'server_not_configured'))
    }
  }

  const api = createApi({ store: options.store, config, now: Date.now, uuid: randomUUID, sleep: options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))) })
  return async (request) => {
    if (new URL(request.url).pathname.replace(/^\/api/, '') === '/status') return json({ configured: true, ...(note ? { note } : {}) })
    return api(request)
  }
}
