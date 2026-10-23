import { reactive } from 'vue'
import { EventDispatcher } from '@/domain/eventDispatcher'
import type { EventKind, EventPayloadMap, LoveEvent } from '@/domain/events'
import type { EventHandler } from '@/domain/eventDispatcher'
import { ServerClock } from '@/data/clock'
import { IdbStore } from '@/data/idb'
import { EventInbox } from '@/data/inbox'
import { Outbox, type OutboxFailure, type OutboxItem, type OutboxStore } from '@/data/outbox'
import { RealtimeHub, type ConnectionStatus, type WatchedTable } from '@/data/realtime'
import { acknowledgeEvents, fetchServerTimeMs, fetchUnseenEvents, sendQueuedEvent } from '@/data/repos/events'
import { db } from '@/data/supabase'

/** Connection, queue and presence state for the UI. */
export const live = reactive<{
  status: ConnectionStatus
  pending: number
  sending: boolean
  failures: readonly OutboxFailure[]
  partnerHere: boolean
}>({ status: 'idle', pending: 0, sending: false, failures: [], partnerHere: false })

let dispatcher: EventDispatcher | null = null
let inbox: EventInbox | null = null
let outbox: Outbox | null = null
let hub: RealtimeHub | null = null
let clock: ServerClock | null = null
const tableListeners = new Map<WatchedTable, Set<() => void>>()
const heartListeners = new Set<() => void>()
const pendingTables = new Set<WatchedTable>()
let tableFlush: ReturnType<typeof setTimeout> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null

class IdbOutboxStore implements OutboxStore {
  private readonly store: IdbStore<OutboxItem>
  constructor(userId: string) {
    this.store = new IdbStore<OutboxItem>(`signalhome-outbox-${userId}`, 'items')
  }
  load(): Promise<OutboxItem[]> {
    return this.store.all().catch(() => [])
  }
  async put(item: OutboxItem): Promise<void> {
    await this.store.put(item)
  }
  async remove(id: string): Promise<void> {
    await this.store.delete(id)
  }
}

export interface LiveContext {
  userId: string
  householdId: string
}

export async function startLive(context: LiveContext, onCatchUpError?: (error: unknown) => void): Promise<void> {
  stopLive()
  const client = db()
  dispatcher = new EventDispatcher()
  inbox = new EventInbox({
    dispatcher,
    fetchUnseen: () => fetchUnseenEvents(context.userId),
    acknowledge: acknowledgeEvents,
    ...(onCatchUpError ? { onError: onCatchUpError } : {}),
  })
  clock = new ServerClock(fetchServerTimeMs)
  outbox = new Outbox({
    store: new IdbOutboxStore(context.userId),
    send: sendQueuedEvent,
    onChange: (snapshot) => {
      live.pending = snapshot.pending
      live.sending = snapshot.sending
      live.failures = snapshot.failures
    },
  })
  hub = new RealtimeHub({
    client,
    userId: context.userId,
    householdId: context.householdId,
    inbox,
    onStatus: (status) => {
      live.status = status
      if (status === 'live') void outbox?.flush() // connection (re)established: push anything that was queued
    },
    onTableChange: (table) => {
      pendingTables.add(table)
      tableFlush ??= setTimeout(flushTables, 150) // coalesce bursts into one refresh per table
    },
    onPartnerPresence: (here) => {
      live.partnerHere = here
    },
    onPartnerHeart: () => heartListeners.forEach((listener) => listener()),
  })
  await outbox.init()
  hub.start()
  void clock.sync().catch(() => {})
  clockTimer = setInterval(() => void clock?.sync(1).catch(() => {}), 5 * 60 * 1000)
}

function flushTables(): void {
  tableFlush = null
  for (const table of pendingTables) tableListeners.get(table)?.forEach((listener) => listener())
  pendingTables.clear()
}

export function stopLive(): void {
  hub?.stop()
  outbox?.dispose()
  if (tableFlush) clearTimeout(tableFlush)
  if (clockTimer) clearInterval(clockTimer)
  tableFlush = clockTimer = null
  hub = null
  outbox = null
  inbox = null
  dispatcher = null
  clock = null
  pendingTables.clear()
  Object.assign(live, { status: 'idle', pending: 0, sending: false, failures: [], partnerHere: false })
}

/** Queues an event for the partner. Durable: survives going offline or closing the app. */
export async function sendEvent<K extends EventKind>(kind: K, payload: EventPayloadMap[K] | Record<string, unknown>, ttlSeconds: number | null = null): Promise<void> {
  if (!outbox) throw new Error('Not connected to a household yet')
  await outbox.enqueue(kind, payload, ttlSeconds)
}

export function onEvent<K extends EventKind>(kind: K, handler: EventHandler<K>): () => void {
  if (!dispatcher) throw new Error('Not connected to a household yet')
  return dispatcher.on(kind, handler)
}

export function onTableChange(table: WatchedTable, listener: () => void): () => void {
  const set = tableListeners.get(table) ?? new Set()
  set.add(listener)
  tableListeners.set(table, set)
  return () => set.delete(listener)
}

export function onPartnerHeart(listener: () => void): () => void {
  heartListeners.add(listener)
  return () => heartListeners.delete(listener)
}

export function broadcastHeart(): void {
  void hub?.broadcastHeart()
}

export function retryOutbox(): void {
  void outbox?.flush()
}

export function dismissOutboxFailure(id: string): void {
  outbox?.dismissFailure(id)
}

/** Best estimate of the database server's clock, in ms since epoch. */
export function serverNow(): number {
  return clock ? clock.serverNow() : Date.now()
}

export type { LoveEvent }
