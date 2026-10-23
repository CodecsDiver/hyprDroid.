import { describe, expect, it, vi } from 'vitest'
import { AppError } from '@/data/errors'
import { MemoryOutboxStore, Outbox, type OutboxItem, type SendResult } from '@/data/outbox'

function harness(options: { online?: () => boolean; send?: (item: OutboxItem) => Promise<SendResult>; store?: MemoryOutboxStore; now?: () => number; maxAttempts?: number; maxAgeMs?: number } = {}) {
  let clock = 1_000_000
  const timers: { cb: () => void; at: number }[] = []
  const store = options.store ?? new MemoryOutboxStore()
  const sent: OutboxItem[] = []
  const send = options.send ?? (async (item: OutboxItem) => { sent.push(item); return { ok: true } as const })
  let id = 0
  const outbox = new Outbox({
    store, send, now: options.now ?? (() => clock), isOnline: options.online ?? (() => true),
    newId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
    backoffMs: (attempt) => attempt * 1000, maxAttempts: options.maxAttempts ?? 12, maxAgeMs: options.maxAgeMs,
    schedule: (cb, delay) => { const t = { cb, at: clock + delay }; timers.push(t); return t },
    cancel: (handle) => { const i = timers.indexOf(handle as never); if (i >= 0) timers.splice(i, 1) },
  })
  return {
    outbox, store, sent, timers,
    advance: async (ms: number) => { clock += ms; for (const t of [...timers]) if (t.at <= clock) { timers.splice(timers.indexOf(t), 1); t.cb() } await outbox.flush() },
  }
}

describe('Outbox', () => {
  it('persists an event before attempting delivery', async () => {
    const store = new MemoryOutboxStore()
    let persistedBeforeSend = false
    const { outbox } = harness({ store, send: async (item) => { persistedBeforeSend = store.items.has(item.id); return { ok: true } } })
    await outbox.enqueue('heart_tap', {})
    await outbox.flush()
    expect(persistedBeforeSend).toBe(true)
    expect(store.items.size).toBe(0) // removed after success
  })

  it('does not touch the network while offline, then delivers when back online', async () => {
    let online = false
    const { outbox, sent } = harness({ online: () => online })
    await outbox.enqueue('love_ping', { reaction: 'heart' })
    await outbox.flush()
    expect(sent).toHaveLength(0)
    expect(outbox.pending).toBe(1)
    online = true
    await outbox.flush()
    expect(sent).toHaveLength(1)
    expect(outbox.pending).toBe(0)
  })

  it('retries with the SAME id so server-side idempotency prevents duplicates', async () => {
    const attempts: string[] = []
    let fail = true
    const { outbox, advance } = harness({ send: async (item) => { attempts.push(item.id); return fail ? { ok: false, code: 'network', retryable: true } : { ok: true } } })
    const item = await outbox.enqueue('hug', {})
    await outbox.flush()
    fail = false
    await advance(5_000)
    expect(attempts).toEqual([item.id, item.id])
    expect(outbox.pending).toBe(0)
  })

  it('preserves order: a waiting item blocks the ones behind it', async () => {
    const order: string[] = []
    let failFirst = true
    const { outbox, advance } = harness({
      send: async (item) => {
        const label = (item.payload as { message?: string }).message ?? ''
        if (label === 'first' && failFirst) return { ok: false, code: 'network', retryable: true }
        order.push(label)
        return { ok: true }
      },
    })
    await outbox.enqueue('hug', { message: 'first' })
    await outbox.enqueue('hug', { message: 'second' })
    await outbox.flush()
    expect(order).toEqual([])
    failFirst = false
    await advance(5_000)
    expect(order).toEqual(['first', 'second'])
  })

  it('drops permanently-failing items and reports why, without blocking the queue', async () => {
    const { outbox, sent } = harness({
      send: async (item) => ((item.payload as { effect?: string }).effect === 'shake_room' ? { ok: false, code: 'recipient_declined', retryable: false } : (sent2.push(item), { ok: true })),
    })
    const sent2: OutboxItem[] = []
    await outbox.enqueue('mischief', { effect: 'shake_room' })
    await outbox.enqueue('heart_tap', {})
    await outbox.flush()
    expect(sent).toHaveLength(0)
    expect(sent2).toHaveLength(1)
    expect(outbox.snapshot().failures).toEqual([expect.objectContaining({ code: 'recipient_declined', kind: 'mischief' })])
    expect(outbox.pending).toBe(0)
  })

  it('classifies thrown errors: network is retried, AppError permanent codes are dropped', async () => {
    const throwNext: unknown[] = [new TypeError('Failed to fetch'), new AppError('invalid_payload')]
    const { outbox, advance } = harness({ send: async () => { throw throwNext.shift() } })
    await outbox.enqueue('heart_tap', {})
    await outbox.flush()
    expect(outbox.pending).toBe(1) // network error → kept
    await advance(5_000)
    expect(outbox.pending).toBe(0) // permanent error → dropped
    expect(outbox.snapshot().failures[0]?.code).toBe('invalid_payload')
  })

  it('survives an app restart: queued items are reloaded and delivered', async () => {
    const store = new MemoryOutboxStore()
    const first = harness({ store, online: () => false })
    await first.outbox.enqueue('love_ping', { reaction: 'kiss' })
    first.outbox.dispose()

    const second = harness({ store })
    await second.outbox.init()
    await second.outbox.flush()
    expect(second.sent).toHaveLength(1)
    expect(second.sent[0]!.kind).toBe('love_ping')
  })

  it('drops events that have been waiting longer than the maximum age', async () => {
    let clockMs = 0
    const store = new MemoryOutboxStore()
    const { outbox, sent } = harness({ store, now: () => clockMs, maxAgeMs: 1000, online: () => clockMs > 5000 })
    await outbox.enqueue('heart_tap', {})
    clockMs = 6000
    await outbox.flush()
    expect(sent).toHaveLength(0)
    expect(outbox.snapshot().failures[0]?.code).toBe('expired')
  })

  it('gives up after the maximum number of attempts', async () => {
    const { outbox, advance } = harness({ send: async () => ({ ok: false, code: 'network', retryable: true }), maxAttempts: 3 })
    await outbox.enqueue('heart_tap', {})
    await outbox.flush()
    await advance(10_000)
    await advance(10_000)
    expect(outbox.pending).toBe(0)
    expect(outbox.snapshot().failures[0]?.code).toBe('gave_up')
  })

  it('rejects invalid payloads before anything is persisted', async () => {
    const { outbox, store } = harness()
    await expect(outbox.enqueue('love_ping', { reaction: 'nonsense' })).rejects.toThrow()
    expect(store.items.size).toBe(0)
  })

  it('notifies listeners of changes', async () => {
    const changes = vi.fn()
    const store = new MemoryOutboxStore()
    const outbox = new Outbox({ store, send: async () => ({ ok: true }), onChange: changes })
    await outbox.enqueue('heart_tap', {})
    await outbox.flush()
    expect(changes).toHaveBeenCalled()
    expect(changes.mock.calls.at(-1)?.[0].pending).toBe(0)
  })
})
