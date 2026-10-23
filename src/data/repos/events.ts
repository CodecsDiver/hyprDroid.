import type { EventKind } from '@/domain/events'
import { toAppError } from '../errors'
import { unwrap } from '../query'
import type { OutboxItem, SendResult } from '../outbox'
import { db } from '../supabase'

export async function sendQueuedEvent(item: OutboxItem): Promise<SendResult> {
  const { error } = await db().rpc('send_event', {
    p_client_event_id: item.id,
    p_kind: item.kind,
    p_payload: item.payload,
    p_ttl_seconds: item.ttlSeconds,
  })
  if (!error) return { ok: true }
  const app = toAppError(error)
  return { ok: false, code: app.code, retryable: app.retryable }
}

export async function fetchUnseenEvents(userId: string): Promise<unknown[]> {
  const rows = await unwrap(
    db().from('events').select('*').eq('recipient_id', userId).is('seen_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true }).limit(200),
  )
  return (rows ?? []) as unknown[]
}

export async function fetchRecentEvents(kinds: readonly EventKind[], limit = 30): Promise<unknown[]> {
  const rows = await unwrap(db().from('events').select('*').in('kind', [...kinds]).order('created_at', { ascending: false }).limit(limit))
  return (rows ?? []) as unknown[]
}

export async function acknowledgeEvents(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await unwrap(db().rpc('ack_events', { p_ids: ids }))
}

export async function fetchServerTimeMs(): Promise<number> {
  const iso = await unwrap<string>(db().rpc('server_now'))
  return Date.parse(iso)
}
