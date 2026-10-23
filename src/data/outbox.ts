import { sanitizePayload, type EventKind, type EventPayloadMap } from '@/domain/events'
import { toAppError } from './errors'

/**
 * Durable outbound queue.
 *
 * Every send is persisted BEFORE the network is touched, so closing the tab,
 * losing signal or crashing never loses a love ping. Retries are safe because
 * the server de-duplicates on `client_event_id` (the item id).
 */

export interface OutboxItem {
  /** Doubles as the server-side idempotency key (client_event_id). */
  id: string
  kind: EventKind
  payload: unknown
  ttlSeconds: number | null
  createdAt: number
  attempts: number
  nextAttemptAt: number
}

export interface OutboxStore {
  load(): Promise<OutboxItem[]>
  put(item: OutboxItem): Promise<void>
  remove(id: string): Promise<void>
}

export class MemoryOutboxStore implements OutboxStore {
  readonly items = new Map<string, OutboxItem>()
  async load(): Promise<OutboxItem[]> {
    return [...this.items.values()].map((item) => ({ ...item }))
  }
  async put(item: OutboxItem): Promise<void> {
    this.items.set(item.id, { ...item })
  }
  async remove(id: string): Promise<void> {
    this.items.delete(id)
  }
}

export type SendResult = { ok: true } | { ok: false; code: string; retryable: boolean }

export interface OutboxFailure {
  id: string
  kind: EventKind
  code: string
  message: string
}

export interface OutboxSnapshot {
  pending: number
  sending: boolean
  failures: readonly OutboxFailure[]
}

export interface OutboxOptions {
  store: OutboxStore
  send: (item: OutboxItem) => Promise<SendResult>
  now?: () => number
  isOnline?: () => boolean
  newId?: () => string
  backoffMs?: (attempt: number) => number
  maxAttempts?: number
  /** Client-side upper bound on how long an undelivered event stays worth sending. */
  maxAgeMs?: number
  onChange?: (snapshot: OutboxSnapshot) => void
  schedule?: (callback: () => void, delayMs: number) => unknown
  cancel?: (handle: unknown) => void
}

const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function defaultBackoff(attempt: number): number {
  const base = Math.min(2 ** attempt * 1000, 5 * 60 * 1000)
  return base / 2 + Math.random() * (base / 2)
}

const FAILURE_MESSAGES: Record<string, string> = {
  recipient_declined: 'They have not opted in to that.',
  invalid_payload: 'That message was not valid.',
  no_partner: 'Your partner has not joined yet.',
  expired: 'It took too long to deliver, so it was dropped.',
  gave_up: 'It could not be delivered after many tries.',
}

export class Outbox {
  private items: OutboxItem[] = []
  private failures: OutboxFailure[] = []
  private flushing: Promise<void> | null = null
  private timer: unknown = null
  private disposed = false
  private readonly o: Required<Omit<OutboxOptions, 'onChange'>> & Pick<OutboxOptions, 'onChange'>

  constructor(options: OutboxOptions) {
    this.o = {
      now: Date.now,
      isOnline: () => (typeof navigator === 'undefined' || navigator.onLine !== false),
      newId: () => crypto.randomUUID(),
      backoffMs: defaultBackoff,
      maxAttempts: 12,
      maxAgeMs: DEFAULT_MAX_AGE_MS,
      schedule: (callback, delayMs) => setTimeout(callback, delayMs),
      cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      ...options,
    }
  }

  async init(): Promise<void> {
    this.items = (await this.o.store.load()).sort((a, b) => a.createdAt - b.createdAt)
    this.emit()
    void this.flush()
  }

  get pending(): number {
    return this.items.length
  }

  snapshot(): OutboxSnapshot {
    return { pending: this.items.length, sending: this.flushing !== null, failures: [...this.failures] }
  }

  dismissFailure(id: string): void {
    this.failures = this.failures.filter((failure) => failure.id !== id)
    this.emit()
  }

  /** Validates, persists, then attempts delivery. Throws ValidationError for bad input (nothing is queued). */
  async enqueue<K extends EventKind>(kind: K, payload: EventPayloadMap[K] | Record<string, unknown>, ttlSeconds: number | null = null): Promise<OutboxItem> {
    const clean = sanitizePayload(kind, payload)
    const now = this.o.now()
    const item: OutboxItem = { id: this.o.newId(), kind, payload: clean, ttlSeconds, createdAt: now, attempts: 0, nextAttemptAt: now }
    await this.o.store.put(item)
    this.items.push(item)
    this.emit()
    void this.flush()
    return item
  }

  flush(): Promise<void> {
    if (this.disposed) return Promise.resolve()
    this.flushing ??= this.drain().finally(() => {
      this.flushing = null
      this.emit()
    })
    return this.flushing
  }

  dispose(): void {
    this.disposed = true
    if (this.timer !== null) this.o.cancel(this.timer)
    this.timer = null
  }

  private async drain(): Promise<void> {
    if (this.timer !== null) {
      this.o.cancel(this.timer)
      this.timer = null
    }
    if (!this.o.isOnline()) return
    this.emit()

    // Strictly ordered: the first item that must wait blocks the ones behind it.
    while (this.items.length > 0 && !this.disposed) {
      const item = this.items[0]!
      const now = this.o.now()
      if (item.nextAttemptAt > now) {
        this.armTimer(item.nextAttemptAt - now)
        return
      }
      if (now - item.createdAt > this.o.maxAgeMs) {
        await this.drop(item, 'expired')
        continue
      }

      let result: SendResult
      try {
        result = await this.o.send(item)
      } catch (error) {
        const app = toAppError(error)
        result = { ok: false, code: app.code, retryable: app.retryable }
      }

      if (result.ok) {
        await this.o.store.remove(item.id)
        this.items.shift()
        this.emit()
      } else if (!result.retryable) {
        await this.drop(item, result.code)
      } else {
        item.attempts += 1
        if (item.attempts >= this.o.maxAttempts) {
          await this.drop(item, 'gave_up')
          continue
        }
        item.nextAttemptAt = this.o.now() + this.o.backoffMs(item.attempts)
        await this.o.store.put(item)
        this.armTimer(item.nextAttemptAt - this.o.now())
        return
      }
    }
  }

  private async drop(item: OutboxItem, code: string): Promise<void> {
    await this.o.store.remove(item.id)
    this.items = this.items.filter((candidate) => candidate.id !== item.id)
    this.failures = [...this.failures, { id: item.id, kind: item.kind, code, message: FAILURE_MESSAGES[code] ?? 'It could not be sent.' }].slice(-20)
    this.emit()
  }

  private armTimer(delayMs: number): void {
    if (this.timer !== null || this.disposed) return
    this.timer = this.o.schedule(() => {
      this.timer = null
      void this.flush()
    }, Math.max(250, delayMs))
  }

  private emit(): void {
    this.o.onChange?.(this.snapshot())
  }
}
