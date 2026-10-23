import { describe, expect, it, vi } from 'vitest'
import { EventDispatcher } from '@/domain/eventDispatcher'
import type { LoveEvent } from '@/domain/events'

const NOW = Date.parse('2025-06-01T12:00:00Z')
let counter = 0
function event(overrides: Partial<LoveEvent> = {}): LoveEvent {
  counter++
  const id = `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`
  return {
    id, householdId: id, senderId: id, recipientId: id, clientEventId: id, kind: 'heart_tap', payload: {},
    createdAt: new Date(NOW - 1000).toISOString(), expiresAt: new Date(NOW + 3_600_000).toISOString(), seenAt: null, ...overrides,
  }
}

describe('EventDispatcher', () => {
  it('applies each event exactly once no matter how often it is offered', async () => {
    const dispatcher = new EventDispatcher({ now: () => NOW })
    const handler = vi.fn()
    dispatcher.on('heart_tap', handler)
    const e = event()
    const first = await dispatcher.dispatch([e, e]) // duplicate inside one batch
    const second = await dispatcher.dispatch([e]) // replay from a later catch-up
    expect(handler).toHaveBeenCalledTimes(1)
    expect(first.handled).toEqual([e.id])
    expect(first.duplicates).toEqual([e.id])
    expect(second.duplicates).toEqual([e.id])
  })

  it('processes in server-timestamp order, not arrival order', async () => {
    const dispatcher = new EventDispatcher({ now: () => NOW })
    const order: string[] = []
    dispatcher.on('hug', (e) => { order.push(e.payload.message ?? '') })
    await dispatcher.dispatch([
      event({ kind: 'hug', payload: { message: 'third' }, createdAt: new Date(NOW - 100).toISOString() }),
      event({ kind: 'hug', payload: { message: 'first' }, createdAt: new Date(NOW - 3000).toISOString() }),
      event({ kind: 'hug', payload: { message: 'second' }, createdAt: new Date(NOW - 2000).toISOString() }),
    ])
    expect(order).toEqual(['first', 'second', 'third'])
  })

  it('skips expired events', async () => {
    const dispatcher = new EventDispatcher({ now: () => NOW })
    const handler = vi.fn()
    dispatcher.on('heart_tap', handler)
    const expired = event({ expiresAt: new Date(NOW - 1).toISOString() })
    const result = await dispatcher.dispatch([expired])
    expect(handler).not.toHaveBeenCalled()
    expect(result.expired).toEqual([expired.id])
  })

  it('flags old events as stale so the UI can summarise instead of replaying them', async () => {
    const dispatcher = new EventDispatcher({ now: () => NOW, staleAfterMs: 60_000 })
    const flags: boolean[] = []
    dispatcher.on('heart_tap', (_e, ctx) => { flags.push(ctx.stale) })
    await dispatcher.dispatch([event({ createdAt: new Date(NOW - 5000).toISOString() }), event({ createdAt: new Date(NOW - 3_600_000).toISOString() })])
    expect(flags).toEqual([true, false])
  })

  it('does not remember an event whose handler failed, so it can be retried', async () => {
    const dispatcher = new EventDispatcher({ now: () => NOW })
    let calls = 0
    dispatcher.on('heart_tap', () => { if (++calls === 1) throw new Error('boom') })
    const e = event()
    const first = await dispatcher.dispatch([e])
    expect(first.failed).toHaveLength(1)
    const second = await dispatcher.dispatch([e])
    expect(second.handled).toEqual([e.id])
  })

  it('keeps memory bounded', async () => {
    const dispatcher = new EventDispatcher({ now: () => NOW, memory: 3 })
    const events = Array.from({ length: 6 }, () => event())
    await dispatcher.dispatch(events)
    expect(dispatcher.has(events[0]!.id)).toBe(false)
    expect(dispatcher.has(events[5]!.id)).toBe(true)
  })

  it('unsubscribes handlers', async () => {
    const dispatcher = new EventDispatcher({ now: () => NOW })
    const handler = vi.fn()
    const off = dispatcher.on('heart_tap', handler)
    off()
    await dispatcher.dispatch([event()])
    expect(handler).not.toHaveBeenCalled()
  })
})
