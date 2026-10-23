/** Minimal promise wrapper over one IndexedDB object store (key = `id`). */

export class IdbStore<T extends { id: string }> {
  private dbPromise: Promise<IDBDatabase> | null = null

  constructor(private readonly dbName: string, private readonly storeName: string) {}

  private open(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(this.storeName, { keyPath: 'id' })
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return this.dbPromise
  }

  private async run<R>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<R>): Promise<R> {
    const db = await this.open()
    return new Promise<R>((resolve, reject) => {
      const request = work(db.transaction(this.storeName, mode).objectStore(this.storeName))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  all(): Promise<T[]> {
    return this.run('readonly', (store) => store.getAll() as IDBRequest<T[]>)
  }

  put(value: T): Promise<IDBValidKey> {
    return this.run('readwrite', (store) => store.put(value))
  }

  delete(id: string): Promise<undefined> {
    return this.run('readwrite', (store) => store.delete(id) as IDBRequest<undefined>)
  }

  async close(): Promise<void> {
    if (!this.dbPromise) return
    ;(await this.dbPromise).close()
    this.dbPromise = null
  }
}
