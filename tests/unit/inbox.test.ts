import { describe, expect, it, vi } from 'vitest'
import { EventDispatcher } from '@/domain/eventDispatcher'
import { EventInbox } from '@/data/inbox'

const uuid = () => crypto.randomUUID()
const NOW = Date.parse('2025-06-01T12:00:00Z')
const row = (id = uuid()) => ({
  id, household_id: uuid(), sender_id: uuid(), recipient_id: uuid(), client_event_id: uuid(), kind: 'heart_tap', payload: {},
  created_at: new Date(NOW - 500).toISOString(), expires_at: new Date(NOW + 60_000).toISOString(), seen_at: null,
})

function setup(fetchUnseen: () => Promise<unknown[]> = async () => []) {
  const dispatcher = new EventDispatcher({ now: () => NOW })
  const handled: string[] = []
  dispatcher.on('heart_tap', (e) => { handled.push(e.id) })
  const acknowledge = vi.fn(async (_ids: string[]) => {})
  const onError = vi.fn()
  const inbox = new EventInbox({ dispatcher, fetchUnseen, acknowledge, onError })
  return { inbox, handled, acknowledge, onError }
}

describe('EventInbox', () => {
  it('handles an event delivered by both realtime and catch-up exactly once', async () => {
    const shared = row()
    const { inbox, handled } = setup(async () => [shared])
    await inbox.receive([shared]) // realtime push
    await inbox.catchUp() // reconnect catch-up returns the same row
    expect(handled).toEqual([shared.id])
  })

  it('acknowledges handled events, including duplicates whose earlier ack may have been lost', async () => {
    const e = row()
    const { inbox, acknowledge } = setup()
    await inbox.receive([e])
    await inbox.receive([e])
    expect(acknowledge).toHaveBeenNthCalledWith(1, [e.id])
    expect(acknowledge).toHaveBeenNthCalledWith(2, [e.id])
  })

  it('ignores malformed rows without breaking the batch', async () => {
    const good = row()
    const { inbox, handled } = setup()
    await inbox.receive([{ id: 'x', kind: 'nope' }, null, 'junk', good])
    expect(handled).toEqual([good.id])
  })

  it('retries a failed acknowledgement on the next receive', async () => {
    const e1 = row()
    const e2 = row()
    const { inbox, acknowledge, onError } = setup()
    acknowledge.mockRejectedValueOnce(new Error('offline'))
    await inbox.receive([e1])
    expect(onError).toHaveBeenCalled()
    await inbox.receive([e2])
    expect(acknowledge).toHaveBeenLastCalledWith(expect.arrayContaining([e1.id, e2.id]))
  })

  it('shares one fetch between concurrent catch-ups and survives fetch errors', async () => {
    let calls = 0
    const { inbox, onError } = setup(async () => {
      calls++
      if (calls === 1) throw new Error('network down')
      return []
    })
    await Promise.all([inbox.catchUp(), inbox.catchUp()])
    expect(calls).toBe(1)
    expect(onError).toHaveBeenCalledTimes(1)
    await inbox.catchUp()
    expect(calls).toBe(2)
  })
})
