import type { EventDispatcher } from '@/domain/eventDispatcher'
import { parseEvent, type LoveEvent } from '@/domain/events'

export interface InboxDeps {
  dispatcher: EventDispatcher
  /** Unseen, unexpired events addressed to me, oldest first. */
  fetchUnseen: () => Promise<unknown[]>
  /** Marks events seen on the server. Idempotent. */
  acknowledge: (ids: string[]) => Promise<void>
  onError?: (error: unknown) => void
}

/**
 * Receives events from any source (realtime push, reconnect catch-up, page
 * load) and guarantees each is applied once and acknowledged.
 */
export class EventInbox {
  private catching: Promise<void> | null = null
  private unacked = new Set<string>()

  constructor(private readonly deps: InboxDeps) {}

  async receive(rows: readonly unknown[]): Promise<void> {
    const events = rows.map(parseEvent).filter((event): event is LoveEvent => event !== null)
    const result = await this.deps.dispatcher.dispatch(events)
    // Duplicates are re-acknowledged too: an earlier ack may have been lost with the connection.
    for (const id of [...result.handled, ...result.duplicates]) this.unacked.add(id)
    await this.flushAcks()
  }

  /** Pulls everything missed while offline/backgrounded. Concurrent calls share one fetch. */
  catchUp(): Promise<void> {
    this.catching ??= (async () => {
      try {
        await this.receive(await this.deps.fetchUnseen())
      } catch (error) {
        this.deps.onError?.(error)
      } finally {
        this.catching = null
      }
    })()
    return this.catching
  }

  private async flushAcks(): Promise<void> {
    if (this.unacked.size === 0) return
    const ids = [...this.unacked]
    try {
      await this.deps.acknowledge(ids)
      ids.forEach((id) => this.unacked.delete(id))
    } catch (error) {
      this.deps.onError?.(error) // stays queued; retried on the next receive
    }
  }
}
