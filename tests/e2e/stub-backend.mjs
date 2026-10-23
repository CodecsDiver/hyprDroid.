/**
 * A minimal in-memory stand-in for Supabase (Auth, PostgREST, Storage, Realtime) used by the
 * browser smoke test. It is a TEST DOUBLE: it does not enforce RLS or any security rule.
 * Security is verified separately against real Postgres in tests/db/security.test.ts.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
export const fakeJwt = (claims) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.signature`

export const IDS = {
  me: '00000000-0000-4000-8000-0000000000a1',
  partner: '00000000-0000-4000-8000-0000000000b2',
  household: '00000000-0000-4000-8000-0000000000c3',
}
const uuid = () => crypto.randomUUID()
const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString()

export function createStub({ origin, capsuleFiles = {}, tamperCapsule = false }) {
  const calls = []
  const state = {
    sessionEmail: 'vee@example.test',
    tables: {
      household_members: [{ household_id: IDS.household, user_id: IDS.me, households: { id: IDS.household, name: 'Test Home' } }],
      profiles: [{ id: IDS.me, display_name: 'Vee' }, { id: IDS.partner, display_name: 'Daniel' }],
      household_invites: [],
      user_settings: [{ user_id: IDS.me, notify_love_pings: true, notify_hidden_notes: true, notify_mischief: true, notify_listening_invites: true, allow_mischief: false, allow_disruptive_mischief: false, quiet_hours_start: null, quiet_hours_end: null }],
      household_state: [{ household_id: IDS.household, bond_xp: 45 }],
      moods: [{ user_id: IDS.partner, mood: 'missing', note: 'thinking of you', updated_at: iso(-3_600_000) }],
      garden_plants: [
        { id: uuid(), planted_by: IDS.partner, mood: 'missing', planted_on: '2025-05-30', seed: 123457, water_count: 2, last_watered_at: null },
        { id: uuid(), planted_by: IDS.me, mood: 'cuddly', planted_on: '2025-05-31', seed: 98765, water_count: 0, last_watered_at: null },
      ],
      garden_waterings: [],
      hidden_notes: [
        { id: uuid(), author_id: IDS.partner, recipient_id: IDS.me, object_id: 'obj_guitar', body: 'Hidden under the strings: you are my favorite song.', open_when: 'you miss me', reveal: 'envelope', created_at: iso(-7_200_000), read_at: null },
      ],
      events: [],
      date_ideas: [], love_notes: [
        { id: uuid(), author_id: IDS.partner, voice: 'love', body: 'Test note from Daniel: you make the ordinary feel special.' },
        { id: uuid(), author_id: IDS.partner, voice: 'miss', body: 'Test miss-you note from Daniel.' },
      ],
      stickers: [], spell_recipes: [], reaction_presets: [], tracks: [], playlists: [], playlist_tracks: [],
      listening_consent: [], listening_sessions: [], memories: [],
      time_capsule_items: Object.entries(capsuleFiles).map(([slug, file]) => ({
        id: uuid(), slug, title: `${slug} (original)`, description: 'Archived exactly as it was.', storage_path: `${IDS.household}/${slug}.html`,
        sha256: file.sha256, byte_size: file.bytes.length, archived_at: iso(-86_400_000),
      })),
    },
  }

  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
  const json = (route, body, status = 200, extra = {}) =>
    route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) })

  const eventRow = (kind, payload, sender = IDS.partner) => ({
    id: uuid(), household_id: IDS.household, sender_id: sender, recipient_id: sender === IDS.partner ? IDS.me : IDS.partner,
    client_event_id: uuid(), kind, payload, created_at: iso(), expires_at: iso(3_600_000), seen_at: null,
  })

  async function handle(route) {
    const request = route.request()
    const url = new URL(request.url())
    const { pathname } = url
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })

    if (pathname === '/auth/v1/token') {
      calls.push({ type: 'auth', pathname })
      const exp = Math.floor(Date.now() / 1000) + 86_400
      const access = fakeJwt({ sub: IDS.me, email: state.sessionEmail, role: 'authenticated', exp, aud: 'authenticated' })
      return json(route, {
        access_token: access, token_type: 'bearer', expires_in: 86_400, expires_at: exp, refresh_token: 'refresh',
        user: { id: IDS.me, aud: 'authenticated', email: state.sessionEmail, role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: iso(-1e9) },
      })
    }
    if (pathname === '/auth/v1/user') return json(route, { id: IDS.me, aud: 'authenticated', email: state.sessionEmail, role: 'authenticated' })
    if (pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors })

    const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(pathname)
    if (rpc) {
      const name = rpc[1]
      const args = request.postDataJSON() ?? {}
      calls.push({ type: 'rpc', name, args })
      if (name === 'server_now') return json(route, iso())
      if (name === 'ack_events') return json(route, (args.p_ids ?? []).length)
      if (name === 'send_event') return json(route, { id: uuid(), client_event_id: args.p_client_event_id, kind: args.p_kind, payload: args.p_payload })
      if (name === 'set_mood') {
        state.tables.moods = state.tables.moods.filter((m) => m.user_id !== IDS.me).concat({ user_id: IDS.me, mood: args.p_mood, note: args.p_note, updated_at: iso() })
        return json(route, { ok: true })
      }
      if (name === 'mark_note_read') {
        state.tables.hidden_notes.forEach((n) => { if (n.id === args.p_note) n.read_at = iso() })
        return json(route, { id: args.p_note })
      }
      return json(route, { ok: true })
    }

    const rest = /^\/rest\/v1\/([a-z_]+)$/.exec(pathname)
    if (rest) {
      const table = rest[1]
      if (request.method() === 'GET') {
        calls.push({ type: 'select', table })
        const rows = state.tables[table] ?? []
        const single = (request.headers().accept ?? '').includes('vnd.pgrst.object')
        if (single) return rows[0] ? json(route, rows[0], 200, { 'content-type': 'application/vnd.pgrst.object+json' }) : json(route, { code: 'PGRST116', message: 'no rows' }, 406)
        return json(route, rows)
      }
      const body = request.postDataJSON?.() ?? null
      calls.push({ type: request.method().toLowerCase(), table, body })
      if (request.method() === 'POST') {
        const added = (Array.isArray(body) ? body : [body]).map((row) => ({ id: uuid(), created_at: iso(), author_id: IDS.me, owner_id: IDS.me, ...row }))
        if (table !== 'user_settings') (state.tables[table] ??= []).push(...added)
        return json(route, added, 201)
      }
      if (request.method() === 'PATCH') {
        if (table === 'user_settings') Object.assign(state.tables.user_settings[0], body)
        return json(route, state.tables[table]?.[0] ?? {})
      }
      if (request.method() === 'DELETE') return route.fulfill({ status: 204, headers: cors })
    }

    if (pathname === '/realtime/v1/api/broadcast') return route.fulfill({ status: 202, headers: cors })

    const sign = /^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/.exec(pathname)
    if (sign) return json(route, { signedURL: `/object/sign/${sign[1]}/${sign[2]}?token=t` })
    const download = /^\/storage\/v1\/object\/(?:authenticated\/)?(time-capsule)\/(.+)$/.exec(pathname)
    if (download) {
      calls.push({ type: 'download', path: download[2] })
      const slug = decodeURIComponent(download[2]).split('/').pop().replace('.html', '')
      const file = capsuleFiles[slug]
      if (!file) return json(route, { message: 'not found' }, 404)
      let bytes = file.bytes
      if (tamperCapsule) bytes = Buffer.concat([bytes, Buffer.from('<!-- tampered -->')])
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/html' }, body: bytes })
    }
    if (pathname.startsWith('/storage/v1/object/sign') || pathname.startsWith('/storage/v1/object/')) return route.fulfill({ status: 200, headers: cors, body: '' })

    calls.push({ type: 'unhandled', method: request.method(), pathname })
    return json(route, { message: `stub: unhandled ${request.method()} ${pathname}` }, 404)
  }

  // ---------------------------------------------------------------- realtime (Phoenix protocol)
  const sockets = []
  function attachRealtime(ws) {
    const socket = { ws, topics: new Map() }
    sockets.push(socket)
    const send = (frame) => ws.send(JSON.stringify(frame))
    ws.onMessage((raw) => {
      let message
      try { message = JSON.parse(String(raw)) } catch { return }
      const v2 = Array.isArray(message)
      const [joinRef, ref, topic, event, payload] = v2 ? message : [message.join_ref, message.ref, message.topic, message.event, message.payload]
      const reply = (response, status = 'ok') => send(v2 ? [joinRef, ref, topic, 'phx_reply', { status, response }] : { join_ref: joinRef, ref, topic, event: 'phx_reply', payload: { status, response } })
      if (event === 'phx_join') {
        const changes = (payload?.config?.postgres_changes ?? []).map((c, i) => ({ ...c, id: i + 1 }))
        socket.topics.set(topic, { changes })
        calls.push({ type: 'realtime-join', topic })
        return reply({ postgres_changes: changes })
      }
      if (event === 'phx_leave') return reply({})
      if (event === 'heartbeat') return reply({})
      if (ref) return reply({})
    })
    ws.onClose(() => sockets.splice(sockets.indexOf(socket), 1))
  }

  /** Pushes a database INSERT on `events` to the signed-in user, exactly as Realtime would. */
  function pushEvent(kind, payload, sender = IDS.partner) {
    const row = eventRow(kind, payload, sender)
    state.tables.events.push(row)
    for (const { ws, topics } of sockets) {
      for (const [topic, { changes }] of topics) {
        const binding = changes.find((c) => c.table === 'events')
        if (!binding) continue
        const data = { schema: 'public', table: 'events', commit_timestamp: iso(), type: 'INSERT', columns: [], record: row, old_record: {}, errors: null }
        ws.send(JSON.stringify([null, null, topic, 'postgres_changes', { ids: [binding.id], data }]))
      }
    }
    return row
  }

  return { state, calls, handle, attachRealtime, pushEvent, eventRow, origin, hasRealtime: () => sockets.length > 0 }
}

export function readCapsuleFiles(dir) {
  const files = {}
  for (const slug of ['signal-home', 'love-universe']) {
    try {
      const bytes = readFileSync(`${dir}/time-capsule/${slug}.html`)
      files[slug] = { bytes, sha256: createHash('sha256').update(bytes).digest('hex') }
    } catch { /* optional */ }
  }
  return files
}
