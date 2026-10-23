import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AppConfig } from '@/config/env'

let client: SupabaseClient | null = null

/** Creates the one Supabase client. Only the public anon key ever reaches the browser. */
export function initSupabase(config: AppConfig): SupabaseClient {
  client ??= createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    realtime: { params: { eventsPerSecond: 10 } },
  })
  return client
}

export function db(): SupabaseClient {
  if (!client) throw new Error('Supabase has not been initialised')
  return client
}
