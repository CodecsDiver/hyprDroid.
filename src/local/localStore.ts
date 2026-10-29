import { BytesStore } from '../../server/store'

const DB_NAME = 'signal-home-local'
const STORE = 'kv'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('browser storage did not respond')), ms)
    work.then((value) => { clearTimeout(timer); resolve(value) }, (error) => { clearTimeout(timer); reject(error) })
  })
}

/**
 * The browser's copy of everything: an in-memory map (so reads and the server's conditional writes stay synchronous and
 * atomic) mirrored to this browser's own IndexedDB. Nothing leaves the page. If IndexedDB is unavailable (some private
 * windows) it still works, but forgets everything when the tab closes.
 */
export class LocalStore extends BytesStore {
  private readonly data = new Map<string, Uint8Array>()
  private pending = new Map<string, Uint8Array | null>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private db: IDBDatabase | null = null
  /** False when the browser would not give us storage: data lasts only until the tab closes. */
  persistent = false

  static async open(): Promise<LocalStore> {
    const store = new LocalStore()
    try {
      // Some browsers (and some ways of opening a downloaded file) never answer; do not wait forever.
      const db = await withTimeout(openDb(), 4000)
      await withTimeout(new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const os = tx.objectStore(STORE)
        const keys = os.getAllKeys()
        const values = os.getAll()
        tx.oncomplete = () => {
          ;(keys.result as string[]).forEach((key, i) => store.data.set(key, values.result[i] as Uint8Array))
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }), 8000)
      store.db = db
      store.persistent = true
      const flush = (): void => void store.flush()
      addEventListener('pagehide', flush)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())
    } catch {
      /* memory only */
    }
    return store
  }

  protected read(key: string): Uint8Array | null {
    return this.data.get(key) ?? null
  }

  protected write(key: string, bytes: Uint8Array): void {
    const copy = bytes.slice()
    this.data.set(key, copy)
    this.queue(key, copy)
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key)
    this.queue(key, null)
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.data.keys()].filter((key) => key.startsWith(prefix)).sort()
  }

  /** Every record and file currently stored (for backups). */
  snapshot(): [string, Uint8Array][] {
    return [...this.data.entries()]
  }

  /** Replaces everything with these entries and waits until they are safely written (for restoring a backup). */
  async replaceAll(entries: Map<string, Uint8Array>): Promise<void> {
    await this.clear()
    for (const [key, bytes] of entries) this.write(key, bytes)
    await this.flush()
  }

  /** Forgets everything (used by "Erase everything on this device"). */
  async clear(): Promise<void> {
    this.data.clear()
    this.pending.clear()
    if (!this.db) return
    const db = this.db
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = tx.onerror = () => resolve()
    })
  }

  private queue(key: string, value: Uint8Array | null): void {
    if (!this.db) return
    this.pending.set(key, value)
    this.timer ??= setTimeout(() => void this.flush(), 80)
  }

  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const db = this.db
    if (!db || this.pending.size === 0) return Promise.resolve()
    const batch = this.pending
    this.pending = new Map()
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readwrite')
        const os = tx.objectStore(STORE)
        for (const [key, value] of batch) value === null ? os.delete(key) : os.put(value, key)
        tx.oncomplete = tx.onerror = tx.onabort = () => resolve()
      } catch {
        resolve()
      }
    })
  }
}
