import type { LoveEvent } from '../src/domain/events'
import type { Store } from './store'

const DAY = 86_400_000

/** Housekeeping: expired events (and their idempotency records) and abandoned uploads. Hourly on Netlify. */
export async function purgeExpired(store: Store, now: number): Promise<{ events: number; uploads: number }> {
  let events = 0
  let uploads = 0
  for (const prefix of ['events/', 'inbox/']) {
    for (const key of await store.list(prefix)) {
      const event = (await store.get<LoveEvent>(key))?.value
      if (event && Date.parse(event.expiresAt) + DAY < now) {
        await store.remove(key)
        events++
      }
    }
  }
  for (const key of await store.list('idem/')) {
    const record = (await store.get<{ event: LoveEvent }>(key))?.value
    if (record && Date.parse(record.event.expiresAt) + DAY < now) await store.remove(key)
  }
  for (const key of await store.list('upload/')) {
    const upload = (await store.get<{ createdAt: string }>(key))?.value
    if (upload && Date.parse(upload.createdAt) + DAY < now) {
      const id = key.slice('upload/'.length)
      for (const chunk of await store.list(`chunks/${id}/`)) await store.remove(chunk)
      await store.remove(key)
      uploads++
    }
  }
  return { events, uploads }
}
