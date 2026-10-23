import { getStore } from '@netlify/blobs'
import type { Cond, Entry, Store } from './store'
import { assertSafeKey } from './store'

/** Production storage: Netlify Blobs with strong consistency (needed for conditional writes and read-after-write). */
export function createNetlifyStore(name = 'signal-home'): Store {
  const blobs = getStore({ name, consistency: 'strong' })
  const options = (cond?: Cond) => (cond?.ifNew ? { onlyIfNew: true as const } : cond?.ifMatch !== undefined ? { onlyIfMatch: cond.ifMatch } : {})

  return {
    async get<T>(key: string): Promise<Entry<T> | null> {
      assertSafeKey(key)
      const result = await blobs.getWithMetadata(key, { type: 'json' })
      return result ? { value: result.data as T, etag: result.etag ?? '' } : null
    },
    async put(key, value, cond) {
      assertSafeKey(key)
      const result = await blobs.set(key, JSON.stringify(value), options(cond))
      return result.modified
    },
    async remove(key) {
      assertSafeKey(key)
      await blobs.delete(key)
    },
    async list(prefix) {
      const keys: string[] = []
      for await (const page of blobs.list({ prefix, paginate: true })) for (const blob of page.blobs) keys.push(blob.key)
      return keys.sort()
    },
    async getBytes(key) {
      assertSafeKey(key)
      const data = await blobs.get(key, { type: 'arrayBuffer' })
      return data ? new Uint8Array(data) : null
    },
    async putBytes(key, bytes, cond) {
      assertSafeKey(key)
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      const result = await blobs.set(key, buffer, options(cond))
      return result.modified
    },
  }
}
