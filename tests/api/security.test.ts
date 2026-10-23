/**
 * Security-boundary tests for the API. Every property the previous database-policy suite guaranteed
 * (isolation, consent, idempotency, immutability…) is asserted here against the real request handler.
 */
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ROUTES } from '../../server/app'
import { signToken } from '../../server/crypto'
import { ADMIN_TOKEN, createApp, html, jpeg, mp3, uploadFile, uuid, type App, type Client } from './harness'

let app: App
let daniel: Client
let vee: Client
beforeEach(async () => {
  app = await createApp()
  daniel = await app.session('daniel')
  vee = await app.session('vee')
})

const sampleParams = (pattern: string): string => pattern.replace(/:[a-zA-Z]+/g, (m) => (m === ':n' ? '0' : uuid()))

describe('authentication', () => {
  it('every protected route refuses an unauthenticated caller', async () => {
    const anon = app.client()
    for (const route of ROUTES.filter((r) => r.auth !== 'none')) {
      const reply = await anon.call(route.method, sampleParams(route.pattern), route.method === 'GET' ? undefined : {})
      expect(reply.status, `${route.method} ${route.pattern}`).toBe(401)
    }
  })

  it('admin-only routes refuse even a signed-in user', async () => {
    const reply = await daniel.post('/capsule', { slug: 'x-y', title: 't', fileId: uuid() })
    expect(reply.status).toBe(403)
  })

  it('logs in with a password, sets an HttpOnly SameSite=Strict cookie, and never returns the hash or token', async () => {
    const reply = await app.client().call('POST', '/auth/login', { username: 'Daniel', password: 'correct horse battery' })
    expect(reply.status).toBe(200)
    expect(reply.body).toEqual({ user: { id: 'daniel', name: 'Daniel' }, partner: { id: 'vee', name: 'Vee' } })
    const cookie = reply.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Strict/)
    expect(cookie).toMatch(/Secure/) // https request
    expect(JSON.stringify(reply.body)).not.toMatch(/pbkdf2|token/)
  })

  it('gives the same answer for a wrong password and an unknown user', async () => {
    const wrong = await app.client().call('POST', '/auth/login', { username: 'daniel', password: 'nope' })
    const unknown = await app.client().call('POST', '/auth/login', { username: 'mallory', password: 'nope' })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.body).toEqual(unknown.body)
  })

  it('locks an account after repeated failures, even for the right password, then recovers', async () => {
    const attacker = app.client()
    for (let i = 0; i < 8; i++) expect((await attacker.call('POST', '/auth/login', { username: 'vee', password: `guess${i}` })).status).toBe(401)
    expect((await attacker.call('POST', '/auth/login', { username: 'vee', password: 'staple purple dragon' })).status).toBe(429)
    app.advance(16 * 60 * 1000)
    expect((await attacker.call('POST', '/auth/login', { username: 'vee', password: 'staple purple dragon' })).status).toBe(200)
  })

  it('rejects forged, tampered, expired and unknown-user session tokens', async () => {
    const good = (await daniel.get('/auth/me')).status
    expect(good).toBe(200)
    const secret = 's'.repeat(48)
    const exp = Math.floor(app.clock.t / 1000) + 3600
    const as = (token: string) => app.client().call('GET', '/auth/me', undefined, { cookie: `sh_session=${token}` })
    expect((await as(signToken({ u: 'daniel', e: exp }, 'wrong-secret'.repeat(4)))).status).toBe(401)
    expect((await as(signToken({ u: 'daniel', e: exp - 7200 }, secret))).status).toBe(401)
    expect((await as(signToken({ u: 'mallory', e: exp }, secret))).status).toBe(401)
    const valid = signToken({ u: 'daniel', e: exp }, secret)
    expect((await as(`${valid}x`)).status).toBe(401)
    expect((await as(valid.replace(/^./, 'A'))).status).toBe(401)
    expect((await as('garbage')).status).toBe(401)
    expect((await as(valid)).status).toBe(200)
  })

  it('logout clears the cookie', async () => {
    const reply = await daniel.post('/auth/logout')
    expect(reply.headers.get('set-cookie')).toMatch(/Max-Age=0/)
  })
})

describe('request hardening', () => {
  it('refuses state-changing requests without the anti-CSRF header or flagged cross-site', async () => {
    const noHeader = await app.client().call('POST', '/auth/login', { username: 'daniel', password: 'x' }, { 'x-requested-with': '' })
    expect(noHeader.status).toBe(403)
    const crossSite = await daniel.post('/events', { clientEventId: uuid(), kind: 'heart_tap' }, { 'sec-fetch-site': 'cross-site' })
    expect(crossSite.status).toBe(403)
    expect((await daniel.get('/auth/me', { 'sec-fetch-site': 'cross-site' })).status).toBe(200) // reads carry no side effects
  })

  it('refuses oversized JSON bodies and malformed JSON', async () => {
    expect((await daniel.post('/ideas', { title: 'x'.repeat(70_000) })).status).toBe(413)
    const bad = await daniel.call('POST', '/ideas', undefined, {}, new TextEncoder().encode('{not json'))
    expect(bad.status).toBe(400)
  })

  it('answers unknown paths and wrong methods without leaking details', async () => {
    expect((await daniel.get('/nope')).status).toBe(404)
    expect((await daniel.call('DELETE', '/auth/me')).status).toBe(405)
    const reply = await daniel.get('/nope')
    expect(JSON.stringify(reply.body)).not.toMatch(/at |\.ts|stack/)
  })

  it('refuses path-traversal style ids', async () => {
    for (const id of ['../secrets', '..%2F..%2Fstate%2Fbond', 'a/b', '%00']) {
      const reply = await daniel.get(`/files/${id}`)
      expect([400, 404]).toContain(reply.status)
    }
    expect((await daniel.post('/plants/..%2Fx/water')).status).toBe(400)
  })

  it('API responses are never cacheable and carry nosniff', async () => {
    const reply = await daniel.get('/auth/me')
    expect(reply.headers.get('cache-control')).toBe('no-store')
    expect(reply.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('events', () => {
  const ping = (client: Client, extra: Record<string, unknown> = {}) => client.post('/events', { clientEventId: uuid(), kind: 'love_ping', payload: { reaction: 'heart' }, ...extra })

  it('delivers to the partner only, and the sender cannot target someone else or forge identity', async () => {
    const sent = await ping(daniel, { senderId: 'vee', recipientId: 'daniel' })
    expect(sent.status).toBe(200)
    expect(sent.body).toMatchObject({ senderId: 'daniel', recipientId: 'vee' })
    expect((await vee.get('/events/unseen')).body).toHaveLength(1)
    expect((await daniel.get('/events/unseen')).body).toHaveLength(0)
  })

  it('is idempotent: a replay returns the same event, does not duplicate it, and awards bond XP once', async () => {
    const clientEventId = uuid()
    const first = await daniel.post('/events', { clientEventId, kind: 'hug', payload: {} })
    const xp = (await daniel.get('/state/bond')).body.bondXp
    const second = await daniel.post('/events', { clientEventId, kind: 'hug', payload: {} })
    expect(second.body.id).toBe(first.body.id)
    expect((await vee.get('/events/unseen')).body).toHaveLength(1)
    expect((await daniel.get('/state/bond')).body.bondXp).toBe(xp)
  })

  it('completes a half-finished send on retry instead of losing it', async () => {
    const clientEventId = uuid()
    // Simulate a crash after the idempotency record was written but before the event was delivered.
    const first = await daniel.post('/events', { clientEventId, kind: 'hug', payload: {} })
    for (const key of await app.store.list('inbox/')) await app.store.remove(key)
    for (const key of await app.store.list('events/')) await app.store.remove(key)
    const retry = await daniel.post('/events', { clientEventId, kind: 'hug', payload: {} })
    expect(retry.body.id).toBe(first.body.id)
    expect((await vee.get('/events/unseen')).body).toHaveLength(1)
  })

  it('stamps time on the server and clamps expiry', async () => {
    const reply = await ping(daniel, { ttlSeconds: 999_999_999, createdAt: '1999-01-01T00:00:00Z' })
    expect(Date.parse(reply.body.createdAt)).toBe(app.clock.t)
    expect(Date.parse(reply.body.expiresAt) - app.clock.t).toBeLessThanOrEqual(30 * 86_400_000)
  })

  it('hides expired events', async () => {
    await ping(daniel, { ttlSeconds: 60 })
    app.advance(61_000)
    expect((await vee.get('/events/unseen')).body).toHaveLength(0)
  })

  it('lets only the recipient acknowledge an event', async () => {
    const sent = await ping(daniel)
    expect((await daniel.post('/events/ack', { ids: [sent.body.id] })).body.acknowledged).toBe(0)
    expect((await vee.get('/events/unseen')).body).toHaveLength(1)
    expect((await vee.post('/events/ack', { ids: [sent.body.id] })).body.acknowledged).toBe(1)
    expect((await vee.get('/events/unseen')).body).toHaveLength(0)
    const recent = (await vee.get('/events/recent?kinds=love_ping')).body
    expect(recent[0].seenAt).not.toBeNull()
  })

  it('drops unknown payload keys and rejects malformed payloads', async () => {
    const ok = await ping(daniel, { payload: { reaction: 'heart', evil: '<script>', message: 'hi' } })
    expect(ok.body.payload).toEqual({ reaction: 'heart', message: 'hi' })
    for (const payload of [{ reaction: 'nope' }, { reaction: 'heart', message: 'x'.repeat(281) }, null, []]) {
      expect((await ping(daniel, { payload })).status, JSON.stringify(payload)).toBe(400)
    }
    expect((await daniel.post('/events', { clientEventId: uuid(), kind: 'delete_all' })).status).toBe(400)
    expect((await daniel.post('/events', { clientEventId: 'not-a-uuid', kind: 'hug' })).status).toBe(400)
  })

  it('reserves note_placed for the notes endpoint', async () => {
    const reply = await daniel.post('/events', { clientEventId: uuid(), kind: 'note_placed', payload: { object_id: 'obj_guitar', note_id: uuid() } })
    expect(reply.status).toBe(400)
  })

  it('rate limits a sender without affecting the partner', async () => {
    for (let i = 0; i < 60; i++) expect((await daniel.post('/events', { clientEventId: uuid(), kind: 'heart_tap' })).status).toBe(200)
    expect((await daniel.post('/events', { clientEventId: uuid(), kind: 'heart_tap' })).status).toBe(429)
    expect((await vee.post('/events', { clientEventId: uuid(), kind: 'heart_tap' })).status).toBe(200)
    app.advance(61_000)
    expect((await daniel.post('/events', { clientEventId: uuid(), kind: 'heart_tap' })).status).toBe(200)
  })

  it('caps daily bond XP so it cannot be farmed', async () => {
    for (let i = 0; i < 40; i++) await daniel.post('/events', { clientEventId: uuid(), kind: 'hug', payload: {} })
    expect((await daniel.get('/state/bond')).body.bondXp).toBe(40)
    app.advance(86_400_000)
    await daniel.post('/events', { clientEventId: uuid(), kind: 'hug', payload: {} })
    expect((await daniel.get('/state/bond')).body.bondXp).toBe(42)
  })

  it('the history endpoint only returns events between the two people', async () => {
    await ping(daniel)
    await ping(vee)
    expect((await daniel.get('/events/recent')).body).toHaveLength(2)
  })
})

describe('mischief consent', () => {
  const send = (effect: string) => daniel.post('/events', { clientEventId: uuid(), kind: 'mischief', payload: { effect } })

  it('is refused until the recipient opts in, with a separate opt-in for disruptive effects', async () => {
    expect((await send('confetti')).status).toBe(403)
    expect((await send('confetti')).body.error.code).toBe('recipient_declined')
    await vee.put('/settings', { allowMischief: true })
    expect((await send('confetti')).status).toBe(200)
    expect((await send('shake_room')).status).toBe(403)
    await vee.put('/settings', { allowDisruptiveMischief: true })
    expect((await send('shake_room')).status).toBe(200)
    await vee.put('/settings', { allowMischief: false })
    expect((await send('confetti')).status).toBe(403)
    expect((await vee.get('/settings')).body.allowDisruptiveMischief).toBe(false) // turning the first off turns the stronger one off too
  })

  it('rejects unknown effects, and settings stay private and self-editable only', async () => {
    expect((await send('delete_everything')).status).toBe(400)
    expect((await daniel.put('/settings', { allowMischief: 'yes' })).status).toBe(400)
    expect((await daniel.put('/settings', { quietHoursStart: 25 })).status).toBe(400)
    await daniel.put('/settings', { allowMischief: true, userId: 'vee' })
    expect((await vee.get('/settings')).body.allowMischief).toBe(false) // nobody can change the other person's settings
  })
})

describe('sync (long-poll)', () => {
  it('returns immediately on the first call with versions, and later returns as soon as something is new', async () => {
    const first = await vee.get('/sync?hold=6')
    expect(first.status).toBe(200)
    expect(first.body.events).toEqual([])
    const known = encodeURIComponent(JSON.stringify(first.body.versions))
    const before = app.clock.t
    const idle = await vee.get(`/sync?hold=6&v=${known}`)
    expect(idle.body.events).toEqual([])
    expect(app.clock.t - before).toBeGreaterThanOrEqual(6000) // it waited the full hold
    await daniel.post('/events', { clientEventId: uuid(), kind: 'hug', payload: {} })
    const woke = await vee.get(`/sync?hold=6&v=${known}`)
    expect(woke.body.events).toHaveLength(1)
  })

  it('wakes when a shared collection changes, and tells you when your partner was last here', async () => {
    const first = await vee.get('/sync')
    const known = encodeURIComponent(JSON.stringify(first.body.versions))
    await daniel.post('/ideas', { title: 'Picnic' })
    const next = await vee.get(`/sync?hold=3&v=${known}`)
    expect(next.body.versions.date_ideas).toBeTruthy()
    expect(next.body.partnerLastSeenMs).toBeNull() // Daniel has not synced yet
    await daniel.get('/sync')
    expect((await vee.get('/sync')).body.partnerLastSeenMs).toBe(app.clock.t)
  })

  it('a heart pulse reaches only the partner', async () => {
    const first = await vee.get('/sync')
    const known = encodeURIComponent(JSON.stringify(first.body.versions))
    await daniel.post('/pulse')
    const next = await vee.get(`/sync?hold=3&v=${known}`)
    expect(Object.keys(next.body.versions)).toContain('pulse:vee')
    expect(Object.keys(next.body.versions)).not.toContain('pulse:daniel')
  })
})

describe('hidden notes', () => {
  const place = (client: Client, extra: Record<string, unknown> = {}) => client.post('/notes', { clientNoteId: uuid(), objectId: 'obj_guitar', body: 'the secret body', openWhen: 'you miss me', reveal: 'envelope', ...extra })

  it('are readable by author and recipient, and the event never carries the body', async () => {
    const placed = await place(daniel)
    expect(placed.status).toBe(200)
    expect((await vee.get('/notes')).body).toHaveLength(1)
    const events = (await vee.get('/events/unseen')).body
    expect(events).toHaveLength(1)
    expect(JSON.stringify(events[0].payload)).not.toContain('secret body')
    expect(events[0].payload.object_id).toBe('obj_guitar')
  })

  it('placing is idempotent', async () => {
    const clientNoteId = uuid()
    const a = await place(daniel, { clientNoteId })
    const b = await place(daniel, { clientNoteId })
    expect(b.body.id).toBe(a.body.id)
    expect((await vee.get('/notes')).body).toHaveLength(1)
    expect((await vee.get('/events/unseen')).body).toHaveLength(1)
  })

  it('only the recipient marks it read; only the author deletes it; nobody edits it', async () => {
    const note = (await place(daniel)).body
    expect((await daniel.post(`/notes/${note.id}/read`)).status).toBe(404)
    const read = await vee.post(`/notes/${note.id}/read`)
    expect(read.body.readAt).not.toBeNull()
    expect((await vee.del(`/notes/${note.id}`)).status).toBe(404)
    expect((await vee.patch(`/notes/${note.id}`, { body: 'tampered' })).status).toBe(405)
    expect((await daniel.del(`/notes/${note.id}`)).status).toBe(200)
  })

  it('validates object ids, bodies and reveal styles', async () => {
    expect((await place(daniel, { objectId: 'Bad Id!' })).status).toBe(400)
    expect((await place(daniel, { body: '   ' })).status).toBe(400)
    expect((await place(daniel, { reveal: 'explode' })).status).toBe(400)
    expect((await place(daniel, { clientNoteId: 'nope' })).status).toBe(400)
  })
})

describe('shared data and ownership', () => {
  it('date ideas: both can use them; completion time is server-stamped; ratings are validated', async () => {
    const idea = (await daniel.post('/ideas', { title: 'Picnic', category: 'outdoors' })).body
    expect((await vee.get('/ideas')).body).toHaveLength(1)
    await vee.patch(`/ideas/${idea.id}`, { isFavorite: true })
    const done = await vee.patch(`/ideas/${idea.id}`, { completedAt: '2000-01-01T00:00:00Z', rating: 5 })
    expect(Date.parse(done.body.completedAt)).toBe(app.clock.t)
    expect((await vee.patch(`/ideas/${idea.id}`, { rating: 9 })).status).toBe(400)
    expect((await vee.patch(`/ideas/${idea.id}`, { category: 'nonsense' })).status).toBe(400)
    expect((await vee.patch(`/ideas/${idea.id}`, { createdBy: 'vee' })).body.createdBy).toBe('daniel') // unlisted fields are ignored
    expect((await daniel.post('/ideas', { title: '' })).status).toBe(400)
  })

  it('moods and garden: one seed per person per day, watering once per day, moods validated', async () => {
    await daniel.post('/moods', { mood: 'cuddly', note: 'hi' })
    await daniel.post('/moods', { mood: 'busy' })
    const plants = (await vee.get('/plants')).body
    expect(plants).toHaveLength(1)
    expect((await vee.get('/moods')).body).toMatchObject([{ userId: 'daniel', mood: 'busy' }])
    await vee.post(`/plants/${plants[0].id}/water`)
    await vee.post(`/plants/${plants[0].id}/water`)
    expect((await vee.get('/plants')).body[0].waterCount).toBe(1)
    expect((await vee.get('/plants/watered-today')).body).toEqual([`${plants[0].id}:vee`])
    app.advance(86_400_000)
    await vee.post(`/plants/${plants[0].id}/water`)
    expect((await vee.get('/plants')).body[0].waterCount).toBe(2)
    expect((await daniel.post('/moods', { mood: 'furious' })).status).toBe(400)
    expect((await vee.post(`/plants/${uuid()}/water`)).status).toBe(404)
  })

  it('spell recipes: both read, only the author deletes; invalid effects/colours rejected', async () => {
    const recipe = await vee.post('/recipes', { name: 'Moon tea', ingredients: ['honey'], effect: 'moon_glow', color: '#AABBCC' })
    expect(recipe.body.color).toBe('#aabbcc')
    expect((await daniel.get('/recipes')).body).toHaveLength(1)
    expect((await daniel.del(`/recipes/${recipe.body.id}`)).status).toBe(404)
    expect((await vee.post('/recipes', { name: 'x', effect: 'rm_rf' })).status).toBe(400)
    expect((await vee.post('/recipes', { name: 'x', effect: 'starfall', ingredients: Array(9).fill('a') })).status).toBe(400)
    expect((await vee.del(`/recipes/${recipe.body.id}`)).status).toBe(200)
  })

  it('custom reactions are private to their owner and limited to 24', async () => {
    for (let i = 0; i < 24; i++) expect((await vee.post('/presets', { label: `r${i}`, emoji: '✨' })).status).toBe(200)
    expect((await vee.post('/presets', { label: 'too many', emoji: '✨' })).status).toBe(409)
    expect((await daniel.get('/presets')).body).toHaveLength(0)
    expect((await vee.post('/presets', { label: 'x', emoji: '✨', animation: 'explode' })).status).toBe(409) // limit is checked first
  })

  it('love notes: only the author edits; bulk import is idempotent', async () => {
    const note = (await daniel.post('/love-notes', { voice: 'love', body: 'You are my favorite hello' })).body
    expect((await vee.get('/love-notes')).body).toHaveLength(1)
    expect((await vee.del(`/love-notes/${note.id}`)).status).toBe(404)
    const bulk = { notes: [{ voice: 'love', body: 'one' }, { voice: 'miss', body: 'two' }] }
    expect((await daniel.post('/love-notes/bulk', bulk)).body.added).toBe(2)
    expect((await daniel.post('/love-notes/bulk', bulk)).body.added).toBe(0)
    expect((await daniel.post('/love-notes', { voice: 'shout', body: 'x' })).status).toBe(400)
  })

  it('memories: private ones are visible only to their author; media needs the author’s own vault file', async () => {
    const priv = (await daniel.post('/memories', { kind: 'note', title: 'Diary', body: 'dear diary', visibility: 'private' })).body
    const shared = (await daniel.post('/memories', { kind: 'milestone', title: 'First date', body: 'lovely' })).body
    expect((await vee.get('/memories')).body.map((m: any) => m.id)).toEqual([shared.id])
    expect((await daniel.get('/memories')).body).toHaveLength(2)
    expect((await vee.patch(`/memories/${shared.id}`, { title: 'x' })).status).toBe(404)
    expect((await vee.del(`/memories/${shared.id}`)).status).toBe(404)
    expect((await vee.del(`/memories/${priv.id}`)).status).toBe(404)
    expect((await daniel.post('/memories', { kind: 'photo', title: 'no file' })).status).toBe(400)
    expect((await daniel.post('/memories', { kind: 'note', title: 'no body' })).status).toBe(400)
    const theirs = await uploadFile(vee, 'vault', 'image/jpeg', jpeg())
    expect((await daniel.post('/memories', { kind: 'photo', title: 'borrowed', fileId: theirs.id })).status).toBe(400)
  })
})

describe('files', () => {
  it('chunked upload round-trips exactly, with Range support, and records a SHA-256', async () => {
    const bytes = mp3(7 * 1024 * 1024 + 123) // three chunks
    const meta = await uploadFile(daniel, 'music', 'audio/mpeg', bytes)
    expect(meta.chunks).toBe(3)
    expect(meta.sha256).toMatch(/^[0-9a-f]{64}$/)
    const parts: Uint8Array[] = []
    for (let start = 0; start < bytes.length; ) {
      const reply = await vee.get(`/files/${meta.id}`, { range: `bytes=${start}-` })
      expect(reply.status).toBe(206)
      const body = new Uint8Array(await reply.response.arrayBuffer())
      expect(body.length).toBeLessThanOrEqual(3 * 1024 * 1024)
      parts.push(body)
      start += body.length
    }
    const joined = new Uint8Array(bytes.length)
    let offset = 0
    for (const part of parts) {
      joined.set(part, offset)
      offset += part.length
    }
    expect(Buffer.from(joined).equals(Buffer.from(bytes))).toBe(true) // (toEqual on megabytes of typed array is very slow)
    const middle = await vee.get(`/files/${meta.id}`, { range: 'bytes=3145720-3145735' }) // spans a chunk boundary
    expect(Buffer.from(await middle.response.arrayBuffer()).equals(Buffer.from(bytes.slice(3145720, 3145736)))).toBe(true)
    expect((await vee.get(`/files/${meta.id}`, { range: 'bytes=99999999999-' })).status).toBe(416)
    expect((await vee.get(`/files/${meta.id}`)).status).toBe(400) // large file without a Range header
  })

  it('refuses content that does not match its claimed type, and disallowed or oversized uploads', async () => {
    await expect(uploadFile(daniel, 'cover', 'image/png', html())).rejects.toMatchObject({ reply: { body: { error: { hint: 'content_mismatch' } } } })
    expect((await daniel.post('/files', { kind: 'cover', mime: 'text/html', size: 10 })).status).toBe(400)
    expect((await daniel.post('/files', { kind: 'sticker', mime: 'image/svg+xml', size: 10 })).status).toBe(400) // SVG can carry script
    expect((await daniel.post('/files', { kind: 'cover', mime: 'image/png', size: 4 * 1024 * 1024 })).status).toBe(413)
    expect((await daniel.post('/files', { kind: 'nonsense', mime: 'image/png', size: 4 })).status).toBe(400)
    expect((await daniel.post('/files', { kind: 'capsule', mime: 'text/html', size: 10 })).status).toBe(403)
  })

  it('validates chunks: only the uploader, correct size, in range', async () => {
    const start = (await daniel.post('/files', { kind: 'cover', mime: 'image/jpeg', size: 600 })).body
    const put = (client: Client, n: number, bytes: Uint8Array) => client.call('PUT', `/files/${start.id}/chunks/${n}`, undefined, {}, bytes)
    expect((await put(vee, 0, jpeg())).status).toBe(404)
    expect((await put(daniel, 0, jpeg(10))).status).toBe(400)
    expect((await put(daniel, 5, jpeg())).status).toBe(400)
    expect((await daniel.post(`/files/${start.id}/complete`)).status).toBe(400) // nothing uploaded yet
    expect((await put(daniel, 0, jpeg())).status).toBe(200)
    expect((await vee.post(`/files/${start.id}/complete`)).status).toBe(404)
    expect((await daniel.post(`/files/${start.id}/complete`)).status).toBe(200)
  })

  it('serves files only to people allowed to see them, with a sandboxing policy', async () => {
    const cover = await uploadFile(daniel, 'cover', 'image/jpeg', jpeg())
    const reply = await vee.get(`/files/${cover.id}`)
    expect(reply.status).toBe(200)
    expect(reply.headers.get('content-security-policy')).toMatch(/sandbox/)
    expect(reply.headers.get('x-content-type-options')).toBe('nosniff')
    expect((await app.client().get(`/files/${cover.id}`)).status).toBe(401)
  })

  it('vault files stay private to their author until the memory is shared', async () => {
    const file = await uploadFile(daniel, 'vault', 'image/jpeg', jpeg())
    expect((await vee.get(`/files/${file.id}`)).status).toBe(404)
    const memory = (await daniel.post('/memories', { kind: 'photo', title: 'secret', fileId: file.id, visibility: 'private' })).body
    expect((await vee.get(`/files/${file.id}`)).status).toBe(404)
    await daniel.patch(`/memories/${memory.id}`, { visibility: 'shared' })
    expect((await vee.get(`/files/${file.id}`)).status).toBe(200)
    await daniel.patch(`/memories/${memory.id}`, { visibility: 'private' })
    expect((await vee.get(`/files/${file.id}`)).status).toBe(404)
    expect((await vee.del(`/files/${file.id}`)).status).toBe(404)
    await daniel.del(`/memories/${memory.id}`)
    expect((await daniel.get(`/files/${file.id}`)).status).toBe(404) // deleting the memory deletes its file
  })

  it('tracks, playlists and stickers can only reference the caller’s own uploads of the right kind', async () => {
    const song = await uploadFile(daniel, 'music', 'audio/mpeg', mp3())
    const photo = await uploadFile(daniel, 'cover', 'image/jpeg', jpeg())
    expect((await vee.post('/tracks', { title: 'stolen', audioFileId: song.id })).status).toBe(400)
    expect((await daniel.post('/tracks', { title: 'wrong kind', audioFileId: photo.id })).status).toBe(400)
    const track = (await daniel.post('/tracks', { title: 'Our song', audioFileId: song.id, coverFileId: photo.id, durationMs: 1000 })).body
    expect((await vee.get('/tracks')).body).toHaveLength(1)
    expect((await vee.del(`/tracks/${track.id}`)).status).toBe(404)
    const list = (await daniel.post('/playlists', { name: 'Faves' })).body
    expect((await vee.put(`/playlists/${list.id}/tracks`, { trackIds: [track.id] })).status).toBe(404)
    expect((await daniel.put(`/playlists/${list.id}/tracks`, { trackIds: [uuid()] })).status).toBe(400)
    expect((await daniel.put(`/playlists/${list.id}/tracks`, { trackIds: [track.id, track.id] })).status).toBe(200)
    expect((await vee.get('/playlists')).body[0].trackIds).toEqual([track.id])
    await daniel.del(`/tracks/${track.id}`)
    expect((await vee.get('/playlists')).body[0].trackIds).toEqual([])
    expect((await vee.get(`/files/${song.id}`)).status).toBe(404)

    const sticker = await uploadFile(daniel, 'sticker', 'image/jpeg', jpeg())
    expect((await vee.post('/stickers', { label: 'x', fileId: sticker.id })).status).toBe(400)
    expect((await daniel.post('/stickers/sheet', { fileId: sticker.id, cols: 3, rows: 6, labels: Array.from({ length: 18 }, (_, i) => `s${i}`) })).body.added).toBe(18)
    expect((await daniel.post('/stickers/sheet', { fileId: sticker.id, cols: 3, rows: 6, labels: ['again'] })).body.added).toBe(0)
    expect((await vee.get('/stickers')).body).toHaveLength(18)
  })
})

describe('listening together', () => {
  it('needs both people to opt in; opting out stops the shared session', async () => {
    const song = await uploadFile(daniel, 'music', 'audio/mpeg', mp3())
    const track = (await daniel.post('/tracks', { title: 'Our song', audioFileId: song.id })).body
    const play = () => daniel.post('/listening/command', { action: 'play', trackId: track.id, positionMs: 1500 })
    expect((await play()).body.error.code).toBe('consent_required')
    await daniel.put('/listening/consent', { optedIn: true })
    expect((await play()).status).toBe(403)
    await vee.put('/listening/consent', { optedIn: true })
    const session = await play()
    expect(session.body).toMatchObject({ state: 'playing', positionMs: 1500, updatedAtMs: app.clock.t, hostId: 'daniel' })
    expect((await vee.get('/listening')).body).toMatchObject({ consent: { me: true, partner: true }, session: { state: 'playing' } })
    expect((await vee.get('/events/unseen')).body.some((e: any) => e.kind === 'listening_invite')).toBe(true)
    await vee.put('/listening/consent', { optedIn: false })
    expect((await daniel.get('/listening')).body.session.state).toBe('stopped')
    expect((await daniel.post('/listening/command', { action: 'pause' })).status).toBe(403)
    expect((await daniel.post('/listening/command', { action: 'dance' })).status).toBe(400)
  })
})

describe('time capsule', () => {
  const archive = async (slug: string, content = html()) => {
    const admin = app.client()
    const headers = { 'x-admin-token': ADMIN_TOKEN, 'x-as-user': 'daniel' }
    const start = await admin.call('POST', '/files', { kind: 'capsule', mime: 'text/html', size: content.length }, headers)
    expect(start.status).toBe(200)
    await admin.call('PUT', `/files/${start.body.id}/chunks/0`, undefined, headers, content)
    const done = await admin.call('POST', `/files/${start.body.id}/complete`, {}, headers)
    const item = await admin.call('POST', '/capsule', { slug, title: slug, description: 'archived', fileId: done.body.id }, headers)
    return { done, item }
  }

  it('is written only with the admin token, readable by both, served as inert bytes', async () => {
    const { done, item } = await archive('signal-home')
    expect(item.status).toBe(200)
    expect(item.body.sha256).toBe(done.body.sha256)
    for (const client of [daniel, vee]) expect((await client.get('/capsule')).body).toHaveLength(1)
    const download = await vee.get(`/files/${done.body.id}`)
    expect(download.headers.get('content-type')).toBe('application/octet-stream')
    expect(download.headers.get('content-disposition')).toBe('attachment')
    expect(download.headers.get('content-security-policy')).toMatch(/sandbox/)
  })

  it('is immutable: nobody can overwrite or delete an archived item or its file', async () => {
    const { done } = await archive('signal-home')
    expect((await archive('signal-home')).item.status).toBe(200) // identical re-run is harmless
    expect((await archive('signal-home', html('<html>different</html>'))).item.status).toBe(409)
    expect((await daniel.del(`/files/${done.body.id}`)).status).toBe(403)
    expect((await vee.del(`/files/${done.body.id}`)).status).toBe(404)
    expect((await app.client().call('POST', '/capsule', { slug: 'x-y' }, { 'x-admin-token': 'wrong'.repeat(10) })).status).toBe(401)
  })

  it('the admin token cannot be guessed from a user session', async () => {
    expect((await daniel.call('POST', '/files', { kind: 'capsule', mime: 'text/html', size: 10 })).status).toBe(403)
    expect((await app.client().call('GET', '/auth/me', undefined, { 'x-admin-token': ADMIN_TOKEN })).status).toBe(401) // admin without x-as-user is not a user
  })
})

describe('isolation of the storage layer', () => {
  it('never writes outside the keys it builds (ids are validated before they reach storage)', async () => {
    await daniel.post('/ideas', { title: 'x' })
    for (const key of await app.store.list('')) {
      expect(key).not.toMatch(/\.\.|\/\/|^\//)
    }
    expect(randomUUID()).toBeTruthy()
  })
})
