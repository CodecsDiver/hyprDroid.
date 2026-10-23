import { createApi } from '../../server/app'
import type { ServerConfig } from '../../server/config'
import { purgeExpired } from '../../server/purge'
import { chunkKey } from '../../server/routes/files'
import { setFileHooks } from '@/data/files'
import { setTransport } from '@/data/api'
import type { FileMeta } from '@/shared/types'
import { LocalStore } from './localStore'
import { randomUUID } from './nodeCrypto'
import { bytesFromBase64, type PrivateSeed } from './seed'

/**
 * The whole backend, running inside this page. The same request handler that used to run on a server is wired to a
 * browser-side store; nothing is sent anywhere, there are no accounts, and no device is identified or remembered.
 * "Who is here" is only a choice made on the first screen, and it is forgotten when the page closes.
 */

export const PEOPLE = [
  { id: 'daniel', name: 'Daniel' },
  { id: 'vee', name: 'Vee' },
] as const

// The handler requires *some* caller identity. Offline, the page is its own caller: it acts as whichever person was chosen.
const SELF = 'in-page'
const CONFIG: ServerConfig = {
  users: PEOPLE.map((p) => ({ id: p.id, name: p.name, passwordHash: 'none' })),
  sessionSecret: SELF,
  adminToken: SELF,
}

let store: LocalStore | null = null
let persona: string | null = null
const fileUrls = new Map<string, string>()

export const storageIsPersistent = (): boolean => store?.persistent ?? false
let seedProblem: string | null = null
/** Set if loading your originals on first open failed (the app still works without them). */
export const firstRunProblem = (): string | null => seedProblem

async function registerFile(id: string): Promise<void> {
  if (!store || fileUrls.has(id)) return
  const meta = (await store.get<FileMeta>(`files/${id}`))?.value
  if (!meta || meta.kind === 'capsule') return
  const parts: BlobPart[] = []
  for (let n = 0; n < meta.chunks; n++) {
    const chunk = await store.getBytes(chunkKey(id, n))
    if (chunk) parts.push(chunk as BlobPart)
  }
  fileUrls.set(id, URL.createObjectURL(new Blob(parts, { type: meta.mime })))
}

export async function startLocalBackend(seed: PrivateSeed | null): Promise<void> {
  store = await LocalStore.open()
  const handler = createApi({ store, config: CONFIG, now: Date.now, uuid: randomUUID, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) })

  setTransport((url, init) => {
    const headers = new Headers(init.headers)
    headers.set('x-admin-token', SELF)
    if (persona) headers.set('x-as-user', persona)
    return handler(new Request(new URL(url, 'http://signal-home.local'), { ...init, headers }))
  })
  setFileHooks({ url: (id) => fileUrls.get(id) ?? '', stored: registerFile })

  if (seed && !(await store.get('meta/seeded'))) {
    try {
      await seedFirstRun(seed, (path, method, body, bytes) => call(handler, path, method, body, bytes))
    } catch (error) {
      seedProblem = error instanceof Error ? error.message : String(error) // start anyway; it will try again next time
    }
  }
  await Promise.all((await store.list('files/')).map((key) => registerFile(key.slice('files/'.length))))
  void purgeExpired(store, Date.now()).catch(() => {})
}

/** Chooses (or clears) who is using the page. Forgotten when the page closes. */
export async function setPersona(id: string | null): Promise<void> {
  if (persona && persona !== id && store) await store.remove(`presence/${persona}`) // leaving: do not look "here" to the other person
  persona = id
}

/** Wipes everything this page has stored in the browser, then reloads. */
export async function eraseEverything(): Promise<void> {
  await store?.clear()
  await Promise.all(['', ...PEOPLE.map((p) => `-${p.id}`)].map((suffix) => new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(suffix === '' ? 'signal-home-local' : `signalhome-outbox${suffix}`)
    request.onsuccess = request.onerror = request.onblocked = () => resolve()
  })))
  try { localStorage.clear() } catch { /* nothing to clear */ }
  location.reload()
}

// ------------------------------------------------------------------ first-run seeding (private builds only)
type Call = (path: string, method: string, body?: unknown, bytes?: Uint8Array) => Promise<any>

async function call(handler: (request: Request) => Promise<Response>, path: string, method: string, body?: unknown, bytes?: Uint8Array): Promise<any> {
  const headers: Record<string, string> = { 'x-requested-with': 'signal-home', 'x-admin-token': SELF, 'x-as-user': 'daniel' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await handler(new Request(`http://signal-home.local/api${path}`, { method, headers, body: bytes ? (bytes as BodyInit) : body === undefined ? null : JSON.stringify(body) }))
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`${method} ${path}: ${data?.error?.code ?? response.status}${data?.error?.hint ? ` (${data.error.hint})` : ""}`)
  return data
}

async function seedFile(request: Call, kind: string, mime: string, bytes: Uint8Array): Promise<string> {
  const start = await request('/files', 'POST', { kind, mime, size: bytes.length })
  for (let n = 0; n < start.chunks; n++) await request(`/files/${start.id}/chunks/${n}`, 'PUT', undefined, bytes.subarray(n * start.chunkSize, (n + 1) * start.chunkSize))
  return (await request(`/files/${start.id}/complete`, 'POST', {})).id
}

async function seedFirstRun(seed: PrivateSeed, request: Call): Promise<void> {
  for (const item of seed.capsule) {
    const fileId = await seedFile(request, 'capsule', 'text/html', bytesFromBase64(item.b64))
    await request('/capsule', 'POST', { slug: item.slug, title: item.title, description: item.description, fileId })
  }
  if (seed.stickerSheet) {
    const fileId = await seedFile(request, 'sticker', 'image/jpeg', bytesFromBase64(seed.stickerSheet.b64))
    await request('/stickers/sheet', 'POST', { fileId, cols: seed.stickerSheet.cols, rows: seed.stickerSheet.rows, labels: seed.stickerSheet.labels })
  }
  if (seed.song) {
    const audioFileId = await seedFile(request, 'music', 'audio/mpeg', bytesFromBase64(seed.song.b64))
    await request('/tracks', 'POST', { title: 'Room song', artist: 'From the original Signal Home', audioFileId, coverFileId: null, durationMs: null })
  }
  if (seed.notes.length > 0) await request('/love-notes/bulk', 'POST', { notes: seed.notes })
  await store?.put('meta/seeded', { at: Date.now() })
}
