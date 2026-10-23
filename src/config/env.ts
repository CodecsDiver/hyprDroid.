export interface AppConfig {
  supabaseUrl: string
  supabaseAnonKey: string
}

export type ConfigResult = { ok: true; config: AppConfig } | { ok: false; problems: string[] }

interface RawEnv {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

/** Decodes a JWT payload without verifying it — used only to refuse obviously wrong keys. */
function jwtRole(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const json = atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as { role?: unknown }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

/**
 * Validates frontend configuration. Besides presence and shape, it refuses a
 * service-role key outright: that key bypasses Row Level Security and must
 * never be shipped to a browser.
 */
export function readConfig(env: RawEnv): ConfigResult {
  const problems: string[] = []
  const url = (env.VITE_SUPABASE_URL ?? '').trim()
  const key = (env.VITE_SUPABASE_ANON_KEY ?? '').trim()

  if (!url) problems.push('VITE_SUPABASE_URL is not set.')
  else {
    try {
      const parsed = new URL(url)
      const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
      if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) problems.push('VITE_SUPABASE_URL must use https.')
    } catch {
      problems.push('VITE_SUPABASE_URL is not a valid URL.')
    }
  }

  if (!key) problems.push('VITE_SUPABASE_ANON_KEY is not set.')
  else if (jwtRole(key) === 'service_role' || key.startsWith('sb_secret_')) {
    problems.push('The key provided is a service-role/secret key. It bypasses all security and must never be used in the browser. Use the anon (publishable) key.')
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, config: { supabaseUrl: url, supabaseAnonKey: key } }
}
