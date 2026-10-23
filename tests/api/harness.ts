import { randomUUID } from 'node:crypto'
import { createApi } from '../../server/app'
import { hashPassword } from '../../server/crypto'
import type { ServerConfig } from '../../server/config'
import { MemoryStore } from '../../server/store'

export const ADMIN_TOKEN = 'a'.repeat(40)
export const PASSWORDS = { daniel: 'correct horse battery', vee: 'staple purple dragon' }

export interface Reply {
  status: number
  body: any
  headers: Headers
  response: Response
}

export class Client {
  cookie = ''
  constructor(private readonly app: App, readonly id: 'daniel' | 'vee' | null) {}

  async call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}, raw?: Uint8Array): Promise<Reply> {
    const headers: Record<string, string> = { 'x-requested-with': 'signal-home', ...extra }
    if (this.cookie) headers.cookie = this.cookie
    let payload: BodyInit | undefined
    if (raw) {
      payload = raw as BodyInit
      headers['content-type'] ??= 'application/octet-stream'
    } else if (body !== undefined) {
      payload = JSON.stringify(body)
      headers['content-type'] = 'application/json'
    }
    const response = await this.app.api(new Request(`https://home.test/api${path}`, { method, headers, body: payload }))
    const text = await response.clone().text()
    let parsed: any = text
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      /* binary or text */
    }
    return { status: response.status, body: parsed, headers: response.headers, response }
  }

  get = (path: string, extra?: Record<string, string>) => this.call('GET', path, undefined, extra)
  post = (path: string, body?: unknown, extra?: Record<string, string>) => this.call('POST', path, body ?? {}, extra)
  put = (path: string, body?: unknown) => this.call('PUT', path, body ?? {})
  patch = (path: string, body?: unknown) => this.call('PATCH', path, body ?? {})
  del = (path: string) => this.call('DELETE', path)

  async login(): Promise<this> {
    if (!this.id) return this
    const reply = await this.call('POST', '/auth/login', { username: this.id, password: PASSWORDS[this.id] })
    if (reply.status !== 200) throw new Error(`login failed: ${reply.status} ${JSON.stringify(reply.body)}`)
    this.cookie = (reply.headers.get('set-cookie') ?? '').split(';')[0]!
    return this
  }
}

export class App {
  readonly store = new MemoryStore()
  clock = { t: Date.parse('2025-06-01T12:00:00Z') }
  readonly api: (request: Request) => Promise<Response>
  readonly config: ServerConfig

  constructor(config: ServerConfig) {
    this.config = config
    this.api = createApi({ store: this.store, config, now: () => this.clock.t, uuid: randomUUID, sleep: async (ms) => { this.clock.t += ms } })
  }

  client(id: 'daniel' | 'vee' | null = null): Client {
    return new Client(this, id)
  }
  async session(id: 'daniel' | 'vee'): Promise<Client> {
    return this.client(id).login()
  }
  /** Fast-forward the server clock. */
  advance(ms: number): void {
    this.clock.t += ms
  }
}

let cachedHashes: Record<string, string> | null = null

export async function createApp(): Promise<App> {
  cachedHashes ??= { daniel: await hashPassword(PASSWORDS.daniel, 1000), vee: await hashPassword(PASSWORDS.vee, 1000) }
  return new App({
    users: [
      { id: 'daniel', name: 'Daniel', passwordHash: cachedHashes.daniel! },
      { id: 'vee', name: 'Vee', passwordHash: cachedHashes.vee! },
    ],
    sessionSecret: 's'.repeat(48),
    adminToken: ADMIN_TOKEN,
  })
}

export const uuid = (): string => randomUUID()

/** Uploads a whole file through the chunked API and returns its metadata. */
export async function uploadFile(client: Client, kind: string, mime: string, bytes: Uint8Array): Promise<any> {
  const start = await client.post('/files', { kind, mime, size: bytes.length })
  if (start.status !== 200) throw Object.assign(new Error(`start ${start.status} ${JSON.stringify(start.body)}`), { reply: start })
  const { id, chunkSize, chunks } = start.body
  for (let n = 0; n < chunks; n++) {
    const part = bytes.slice(n * chunkSize, (n + 1) * chunkSize)
    const put = await client.call('PUT', `/files/${id}/chunks/${n}`, undefined, {}, part)
    if (put.status !== 200) throw Object.assign(new Error(`chunk ${put.status}`), { reply: put })
  }
  const done = await client.post(`/files/${id}/complete`)
  if (done.status !== 200) throw Object.assign(new Error(`complete ${done.status} ${JSON.stringify(done.body)}`), { reply: done })
  return done.body
}

export const jpeg = (size = 600): Uint8Array => {
  const bytes = new Uint8Array(size)
  bytes.set([0xff, 0xd8, 0xff, 0xe0])
  for (let i = 4; i < size; i++) bytes[i] = i % 251
  return bytes
}
export const mp3 = (size = 600): Uint8Array => {
  const bytes = new Uint8Array(size)
  bytes.set([0x49, 0x44, 0x33, 4, 0])
  for (let i = 5; i < size; i++) bytes[i] = (i * 7) % 253
  return bytes
}
export const html = (text = '<!doctype html><html><body>archived</body></html>'): Uint8Array => new TextEncoder().encode(text)
