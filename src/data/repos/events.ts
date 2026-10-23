import { parseEvent, type EventKind, type LoveEvent } from '@/domain/events'
import { api } from '../api'
import { toAppError } from '../errors'
import type { OutboxItem, SendResult } from '../outbox'

export async function sendQueuedEvent(item: OutboxItem): Promise<SendResult> {
  try {
    await api.post('/events', { clientEventId: item.id, kind: item.kind, payload: item.payload, ttlSeconds: item.ttlSeconds })
    return { ok: true }
  } catch (error) {
    const app = toAppError(error)
    return { ok: false, code: app.code, retryable: app.retryable }
  }
}

const parseAll = (rows: unknown[]): LoveEvent[] => rows.map(parseEvent).filter((event): event is LoveEvent => event !== null)

export async function fetchUnseenEvents(): Promise<unknown[]> {
  return api.get<unknown[]>('/events/unseen')
}

export async function fetchRecentEvents(kinds: readonly EventKind[], limit = 30): Promise<LoveEvent[]> {
  return parseAll(await api.get<unknown[]>(`/events/recent?kinds=${kinds.join(',')}&limit=${limit}`))
}

export async function acknowledgeEvents(ids: string[]): Promise<void> {
  if (ids.length > 0) await api.post('/events/ack', { ids })
}

export async function fetchServerTimeMs(): Promise<number> {
  return (await api.get<{ nowMs: number }>('/time')).nowMs
}
