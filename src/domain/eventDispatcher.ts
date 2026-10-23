import { isExpired, type EventKind, type LoveEvent } from './events'

export interface DispatchContext {
  /** True when the event is old enough to be "while you were away" rather than live. */
  stale: boolean
}

export type EventHandler<K extends EventKind = EventKind> = (event: LoveEvent<K>, context: DispatchContext) => void | Promise<void>

export interface DispatchResult {
  handled: string[]
  duplicates: string[]
  expired: string[]
  failed: { id: string; error: unknown }[]
}

export interface DispatcherOptions {
  now?: () => number
  /** Events older than this are delivered as "stale" (summarised, not animated one by one). */
  staleAfterMs?: number
  /** How many processed event ids to remember for idempotency. */
  memory?: number
}

/**
 * Applies events exactly once, in order, regardless of how many times the
 * transport (realtime push, reconnect catch-up, page reload race) offers them.
 */
export class EventDispatcher {
  private readonly handlers = new Map<EventKind, Set<EventHandler<never>>>()
  private readonly seen = new Set<string>()
  private readonly now: () => number
  private readonly staleAfterMs: number
  private readonly memory: number

  constructor(options: DispatcherOptions = {}) {
    this.now = options.now ?? Date.now
    this.staleAfterMs = options.staleAfterMs ?? 60_000
    this.memory = options.memory ?? 500
  }

  on<K extends EventKind>(kind: K, handler: EventHandler<K>): () => void {
    const set = this.handlers.get(kind) ?? new Set()
    set.add(handler as EventHandler<never>)
    this.handlers.set(kind, set)
    return () => set.delete(handler as EventHandler<never>)
  }

  has(id: string): boolean {
    return this.seen.has(id)
  }

  async dispatch(events: readonly LoveEvent[]): Promise<DispatchResult> {
    const result: DispatchResult = { handled: [], duplicates: [], expired: [], failed: [] }
    const ordered = [...events].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))
    const batch = new Set<string>()
    const nowMs = this.now()

    for (const event of ordered) {
      if (this.seen.has(event.id) || batch.has(event.id)) {
        result.duplicates.push(event.id)
        continue
      }
      batch.add(event.id)
      if (isExpired(event, nowMs)) {
        result.expired.push(event.id)
        continue
      }
      const context: DispatchContext = { stale: nowMs - Date.parse(event.createdAt) > this.staleAfterMs }
      try {
        for (const handler of this.handlers.get(event.kind) ?? []) await (handler as EventHandler)(event, context)
        this.remember(event.id)
        result.handled.push(event.id)
      } catch (error) {
        // Not remembered: the next catch-up will offer it again.
        result.failed.push({ id: event.id, error })
      }
    }
    return result
  }

  private remember(id: string): void {
    this.seen.add(id)
    if (this.seen.size > this.memory) {
      const oldest = this.seen.values().next().value
      if (oldest !== undefined) this.seen.delete(oldest)
    }
  }
}
