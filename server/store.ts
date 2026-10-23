/**
 * Storage abstraction. Three implementations share one contract:
 *   MemoryStore   tests
 *   FileStore     local dev and self-hosting (a folder of files)
 *   NetlifyStore  production on Netlify (Netlify Blobs, strongly consistent) — see store-netlify.ts
 *
 * Conditional writes (`ifNew`, `ifMatch`) are what make idempotency and read-modify-write safe.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'

export interface Entry<T = unknown> {
  value: T
  etag: string
}

export interface Cond {
  /** Write only if the key does not exist. */
  ifNew?: boolean
  /** Write only if the key still has this etag. */
  ifMatch?: string
}

export interface Store {
  get<T = unknown>(key: string): Promise<Entry<T> | null>
  /** Returns false when a condition was not met (nothing written). */
  put(key: string, value: unknown, cond?: Cond): Promise<boolean>
  remove(key: string): Promise<void>
  /** Keys that start with `prefix`, sorted. */
  list(prefix: string): Promise<string[]>
  getBytes(key: string): Promise<Uint8Array | null>
  putBytes(key: string, bytes: Uint8Array, cond?: Cond): Promise<boolean>
}

const etagOf = (bytes: Uint8Array): string => createHash('sha1').update(bytes).digest('hex')
const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** Keys are built from validated ids, but are re-checked here as defence in depth. */
export function assertSafeKey(key: string): void {
  if (!key || key.length > 400 || key.startsWith('/') || key.includes('\\') || key.includes('\0')) throw new Error('unsafe storage key')
  for (const segment of key.split('/')) if (segment === '' || segment === '.' || segment === '..') throw new Error('unsafe storage key')
}

abstract class BytesStore implements Store {
  protected abstract read(key: string): Uint8Array | null
  protected abstract write(key: string, bytes: Uint8Array): void
  abstract remove(key: string): Promise<void>
  abstract list(prefix: string): Promise<string[]>

  private conditionsMet(key: string, cond?: Cond): boolean {
    if (!cond) return true
    const existing = this.read(key)
    if (cond.ifNew && existing) return false
    if (cond.ifMatch !== undefined && (!existing || etagOf(existing) !== cond.ifMatch)) return false
    return true
  }

  async get<T = unknown>(key: string): Promise<Entry<T> | null> {
    assertSafeKey(key)
    const bytes = this.read(key)
    return bytes ? { value: JSON.parse(decoder.decode(bytes)) as T, etag: etagOf(bytes) } : null
  }

  async put(key: string, value: unknown, cond?: Cond): Promise<boolean> {
    assertSafeKey(key)
    if (!this.conditionsMet(key, cond)) return false // check + write happen in one synchronous step: atomic in a single process
    this.write(key, encoder.encode(JSON.stringify(value)))
    return true
  }

  async getBytes(key: string): Promise<Uint8Array | null> {
    assertSafeKey(key)
    return this.read(key)
  }

  async putBytes(key: string, bytes: Uint8Array, cond?: Cond): Promise<boolean> {
    assertSafeKey(key)
    if (!this.conditionsMet(key, cond)) return false
    this.write(key, bytes)
    return true
  }
}

export class MemoryStore extends BytesStore {
  private readonly data = new Map<string, Uint8Array>()
  protected read(key: string): Uint8Array | null {
    return this.data.get(key) ?? null
  }
  protected write(key: string, bytes: Uint8Array): void {
    this.data.set(key, bytes.slice())
  }
  async remove(key: string): Promise<void> {
    this.data.delete(key)
  }
  async list(prefix: string): Promise<string[]> {
    return [...this.data.keys()].filter((key) => key.startsWith(prefix)).sort()
  }
  get size(): number {
    return this.data.size
  }
}

/** One file per key under `root`. Written atomically (temp file + rename). */
export class FileStore extends BytesStore {
  private readonly root: string
  constructor(root: string) {
    super()
    this.root = resolve(root)
    mkdirSync(this.root, { recursive: true })
  }
  private pathFor(key: string): string {
    const path = resolve(join(this.root, ...key.split('/').map(encodeURIComponent)))
    if (!path.startsWith(this.root + sep)) throw new Error('unsafe storage key')
    return path
  }
  protected read(key: string): Uint8Array | null {
    const path = this.pathFor(key)
    return existsSync(path) && statSync(path).isFile() ? new Uint8Array(readFileSync(path)) : null
  }
  protected write(key: string, bytes: Uint8Array): void {
    const path = this.pathFor(key)
    mkdirSync(dirname(path), { recursive: true })
    const temp = `${path}.${process.pid}.tmp`
    writeFileSync(temp, bytes)
    renameSync(temp, path)
  }
  async remove(key: string): Promise<void> {
    assertSafeKey(key)
    rmSync(this.pathFor(key), { force: true })
  }
  async list(prefix: string): Promise<string[]> {
    const out: string[] = []
    const walk = (dir: string, base: string): void => {
      if (!existsSync(dir)) return
      for (const name of readdirSync(dir)) {
        if (name.endsWith('.tmp')) continue
        const full = join(dir, name)
        const key = base ? `${base}/${decodeURIComponent(name)}` : decodeURIComponent(name)
        if (statSync(full).isDirectory()) walk(full, key)
        else if (key.startsWith(prefix)) out.push(key)
      }
    }
    const slash = prefix.lastIndexOf('/')
    const baseKey = slash >= 0 ? prefix.slice(0, slash) : ''
    if (baseKey) assertSafeKey(baseKey)
    walk(baseKey ? this.pathFor(baseKey) : this.root, baseKey)
    return out.sort()
  }
}
