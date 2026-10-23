import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { assertSafeKey, BytesStore } from './store'

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
