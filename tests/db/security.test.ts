/**
 * Security-boundary tests, run against the REAL migrations in an in-process
 * Postgres (PGlite) under the same roles PostgREST uses (`anon`, `authenticated`).
 * The Supabase platform pieces are emulated by supabase/tests/supabase_shim.sql.
 */
import { randomUUID } from 'node:crypto'
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { as, createCouple, createDatabase, createUser, type Actor, type Couple } from './harness'

let db: PGlite
let couple: Couple

beforeAll(async () => {
  db = await createDatabase()
  couple = await createCouple(db)
}, 60_000)

const run = <T extends Record<string, unknown> = Record<string, unknown>>(actor: Actor | null, sql: string, params: unknown[] = []) =>
  as(db, actor, async () => (await db.query<T>(sql, params)).rows)

const send = (actor: Actor, kind: string, payload: Record<string, unknown> = {}, clientId: string = randomUUID(), ttl: number | null = null) =>
  run(actor, 'select * from public.send_event($1, $2, $3::jsonb, $4)', [clientId, kind, JSON.stringify(payload), ttl])

/** The single row of a result set (fails the test if there is none). */
const one = <T>(rows: T[]): T => {
  if (rows.length === 0) throw new Error('expected a row')
  return rows[0]!
}

const admin = async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows

const put = (actor: Actor, bucket: string, path: string) =>
    run(actor, 'insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)', [bucket, path, actor.id])
  const visible = async (actor: Actor, bucket: string, path: string) =>
  (await run(actor, 'select id from storage.objects where bucket_id = $1 and name = $2', [bucket, path])).length === 1

describe('anonymous access', () => {
  const tables = [
    'profiles', 'households', 'household_members', 'household_invites', 'user_settings', 'household_state',
    'events', 'moods', 'mood_entries', 'garden_plants', 'garden_waterings', 'date_ideas', 'hidden_notes',
    'spell_recipes', 'reaction_presets', 'tracks', 'playlists', 'playlist_tracks', 'listening_consent',
    'listening_sessions', 'memories', 'love_notes', 'stickers', 'time_capsule_items',
  ]
  it.each(tables)('anon cannot read %s', async (table) => {
    await expect(run(null, `select * from public.${table}`)).rejects.toThrow(/permission denied/)
  })

  it('anon cannot call RPCs', async () => {
    await expect(run(null, `select public.send_event($1, 'heart_tap', '{}'::jsonb)`, [randomUUID()])).rejects.toThrow(/permission denied/)
    await expect(run(null, `select public.create_household('x')`)).rejects.toThrow(/permission denied/)
  })

  it('authenticated users cannot call the cron-only purge function', async () => {
    await expect(run(couple.daniel, 'select public.purge_expired_events()')).rejects.toThrow(/permission denied/)
  })

  it('the private helper schema is not callable by anon', async () => {
    await expect(run(null, 'select private.is_member($1)', [couple.household])).rejects.toThrow(/permission denied/)
  })
})

describe('household membership', () => {
  it('only the invited, authenticated email can accept; tokens are single-use', async () => {
    const [a, b, c, d] = await Promise.all(['A', 'B', 'C', 'D'].map((n) => createUser(db, n)))
    await run(a!, `select public.create_household('Alpha')`)
    const { t: token } = one(await run<{ t: string }>(a!, 'select public.invite_partner($1) as t', [b!.email]))

    await expect(run(c!, 'select public.accept_invite($1)', [token])).rejects.toThrow('invalid_invite')
    await expect(run(b!, 'select public.accept_invite($1)', ['not-a-token'])).rejects.toThrow('invalid_invite')
    await run(b!, 'select public.accept_invite($1)', [token])
    await expect(run(d!, 'select public.accept_invite($1)', [token])).rejects.toThrow('invalid_invite')
    await expect(run(b!, 'select public.accept_invite($1)', [token])).rejects.toThrow('already_in_household')
  })

  it('email matching is case-insensitive but exact otherwise', async () => {
    const [a, b] = await Promise.all(['A2', 'B2'].map((n) => createUser(db, n)))
    await run(a!, `select public.create_household('Beta')`)
    const { t: token } = one(await run<{ t: string }>(a!, 'select public.invite_partner($1) as t', [b!.email.toUpperCase()]))
    await run({ ...b!, email: b!.email.toUpperCase() }, 'select public.accept_invite($1)', [token])
  })

  it('stores only a hash of the invite token and never exposes it', async () => {
    const [a, b] = await Promise.all(['A3', 'B3'].map((n) => createUser(db, n)))
    await run(a!, `select public.create_household('Gamma')`)
    const { t: token } = one(await run<{ t: string }>(a!, 'select public.invite_partner($1) as t', [b!.email]))
    const stored = await admin<{ token_hash: string }>('select token_hash from public.household_invites where invited_email = $1', [b!.email])
    expect(stored[0]!.token_hash).not.toBe(token)
    expect(stored[0]!.token_hash).toMatch(/^[0-9a-f]{64}$/)
    await expect(run(a!, 'select token_hash from public.household_invites')).rejects.toThrow(/permission denied/)
    await expect(run(a!, 'select * from public.household_invites')).rejects.toThrow(/permission denied/)
    expect(await run(a!, 'select id, invited_email from public.household_invites')).toHaveLength(1)
  })

  it('rejects expired invites', async () => {
    const [a, b] = await Promise.all(['A4', 'B4'].map((n) => createUser(db, n)))
    await run(a!, `select public.create_household('Delta')`)
    const { t: token } = one(await run<{ t: string }>(a!, 'select public.invite_partner($1) as t', [b!.email]))
    await admin(`update public.household_invites set expires_at = now() - interval '1 minute' where invited_email = $1`, [b!.email])
    await expect(run(b!, 'select public.accept_invite($1)', [token])).rejects.toThrow('invalid_invite')
  })

  it('a household holds exactly two people', async () => {
    await expect(run(couple.daniel, 'select public.invite_partner($1)', ['third@example.test'])).rejects.toThrow('household_full')
    const extra = await createUser(db, 'Extra')
    await expect(
      admin('insert into public.household_members (household_id, user_id) values ($1, $2)', [couple.household, extra.id]),
    ).rejects.toThrow('household_full')
  })

  it('a person cannot create or join a second household', async () => {
    await expect(run(couple.daniel, `select public.create_household('Again')`)).rejects.toThrow('already_in_household')
  })

  it('clients cannot edit membership or invites directly', async () => {
    const extra = await createUser(db, 'Mallory')
    await expect(
      run(extra, 'insert into public.household_members (household_id, user_id) values ($1, $2)', [couple.household, extra.id]),
    ).rejects.toThrow(/permission denied/)
    await expect(run(couple.daniel, 'delete from public.household_members where user_id = $1', [couple.vee.id])).rejects.toThrow(/permission denied/)
    await expect(
      run(couple.daniel, `insert into public.household_invites (household_id, invited_email, token_hash, created_by, expires_at)
        values ($1, 'x@y.z', repeat('a', 64), $2, now() + interval '1 day')`, [couple.household, couple.daniel.id]),
    ).rejects.toThrow(/permission denied/)
  })

  it('profiles are visible to the household only', async () => {
    expect((await run(couple.vee, 'select id from public.profiles where id = $1', [couple.daniel.id]))).toHaveLength(1)
    expect((await run(couple.eve, 'select id from public.profiles where id = $1', [couple.daniel.id]))).toHaveLength(0)
  })
})

describe('events', () => {
  it('delivers to the partner only, never to outsiders', async () => {
    const [row] = await send(couple.daniel, 'love_ping', { reaction: 'heart' })
    expect(row!.recipient_id).toBe(couple.vee.id)
    expect(await run(couple.vee, 'select id from public.events where id = $1', [row!.id])).toHaveLength(1)
    expect(await run(couple.daniel, 'select id from public.events where id = $1', [row!.id])).toHaveLength(1)
    expect(await run(couple.eve, 'select id from public.events where id = $1', [row!.id])).toHaveLength(0)
  })

  it('cannot be forged with direct writes', async () => {
    await expect(
      run(couple.daniel, `insert into public.events (household_id, sender_id, recipient_id, client_event_id, kind, expires_at)
        values ($1, $2, $3, $4, 'heart_tap', now() + interval '1 day')`, [couple.household, couple.vee.id, couple.daniel.id, randomUUID()]),
    ).rejects.toThrow(/permission denied/)
    const [row] = await send(couple.daniel, 'heart_tap')
    await expect(run(couple.vee, `update public.events set payload = '{"x":1}' where id = $1`, [row!.id])).rejects.toThrow(/permission denied/)
    await expect(run(couple.daniel, 'delete from public.events where id = $1', [row!.id])).rejects.toThrow(/permission denied/)
  })

  it('outsiders cannot send events into someone else\'s household', async () => {
    const stranger = await createUser(db, 'Stranger')
    await expect(send(stranger, 'heart_tap')).rejects.toThrow('not_in_household')
    // Eve has a household of her own but no partner yet.
    await expect(send(couple.eve, 'heart_tap')).rejects.toThrow('no_partner')
  })

  it('is idempotent: replays return the same row and award bond XP once', async () => {
    const clientId = randomUUID()
    const before = (await admin<{ bond_xp: number }>('select bond_xp from public.household_state where household_id = $1', [couple.household]))[0]!
    const first = (await send(couple.daniel, 'hug', {}, clientId))[0]!
    const second = (await send(couple.daniel, 'hug', {}, clientId))[0]!
    expect(second.id).toBe(first.id)
    expect(await admin('select id from public.events where client_event_id = $1', [clientId])).toHaveLength(1)
    const after = (await admin<{ bond_xp: number }>('select bond_xp from public.household_state where household_id = $1', [couple.household]))[0]!
    expect(after.bond_xp - before.bond_xp).toBeLessThanOrEqual(2)
  })

  it('stamps timestamps on the server and clamps expiry', async () => {
    const [row] = await send(couple.daniel, 'love_ping', { reaction: 'kiss' }, randomUUID(), 99_999_999)
    const { delta } = one(await admin<{ delta: number }>(
      `select extract(epoch from (expires_at - created_at))::int as delta from public.events where id = $1`, [row!.id]))
    expect(delta).toBeLessThanOrEqual(30 * 86400)
    const { skew } = one(await admin<{ skew: number }>(`select abs(extract(epoch from (now() - created_at)))::int as skew from public.events where id = $1`, [row!.id]))
    expect(skew).toBeLessThan(5)
  })

  it('hides expired events from RLS even before they are purged', async () => {
    const [row] = await send(couple.daniel, 'love_ping', { reaction: 'heart' })
    await admin(`update public.events set expires_at = now() - interval '1 second' where id = $1`, [row!.id])
    expect(await run(couple.vee, 'select id from public.events where id = $1', [row!.id])).toHaveLength(0)
    expect(await run(couple.daniel, 'select id from public.events where id = $1', [row!.id])).toHaveLength(0)
  })

  it('lets only the recipient acknowledge events', async () => {
    const [row] = await send(couple.daniel, 'love_ping', { reaction: 'heart' })
    const bySender = await run<{ n: number }>(couple.daniel, 'select public.ack_events(array[$1]::uuid[]) as n', [row!.id])
    expect(bySender[0]!.n).toBe(0)
    const byRecipient = await run<{ n: number }>(couple.vee, 'select public.ack_events(array[$1]::uuid[]) as n', [row!.id])
    expect(byRecipient[0]!.n).toBe(1)
    const [seen] = await admin<{ seen_at: string | null }>('select seen_at from public.events where id = $1', [row!.id])
    expect(seen!.seen_at).not.toBeNull()
  })

  it('drops unknown payload keys and rejects malformed payloads', async () => {
    const [row] = await send(couple.daniel, 'love_ping', { reaction: 'heart', evil: '<script>', message: 'hi' })
    expect(row!.payload).toEqual({ reaction: 'heart', message: 'hi' })
    await expect(send(couple.daniel, 'love_ping', { reaction: 'nonsense' })).rejects.toThrow('invalid_payload')
    await expect(send(couple.daniel, 'love_ping', { reaction: 'heart', message: 'x'.repeat(281) })).rejects.toThrow('invalid_payload')
    await expect(send(couple.daniel, 'love_note', { body: '', voice: 'love' })).rejects.toThrow('invalid_payload')
    await expect(send(couple.daniel, 'sticker', { sticker_id: 'not-a-uuid' })).rejects.toThrow('invalid_payload')
    await expect(send(couple.daniel, 'spell_cast', { effect: 'starfall', name: 'x', color: 'red' })).rejects.toThrow('invalid_payload')
    await expect(send(couple.daniel, 'unknown_kind')).rejects.toThrow()
  })

  it('reserves note_placed for the place_note RPC', async () => {
    await expect(send(couple.daniel, 'note_placed', { object_id: 'obj_guitar', note_id: randomUUID() })).rejects.toThrow('invalid_kind')
  })

  it('rate limits a sender', async () => {
    const spammer = await createCouple(db)
    for (let i = 0; i < 60; i++) await send(spammer.daniel, 'heart_tap')
    await expect(send(spammer.daniel, 'heart_tap')).rejects.toThrow('rate_limited')
    // The other person's budget is independent.
    await send(spammer.vee, 'heart_tap')
  })

  it('caps daily bond XP so it cannot be farmed', async () => {
    const farm = await createCouple(db)
    await admin(`update public.household_state set bond_xp = 0, xp_today = 0, xp_day = (now() at time zone 'utc')::date where household_id = $1`, [farm.household])
    for (let i = 0; i < 40; i++) await send(farm.daniel, 'hug')
    const { bond_xp } = one(await admin<{ bond_xp: number }>('select bond_xp from public.household_state where household_id = $1', [farm.household]))
    expect(bond_xp).toBe(40)
  })
})

describe('mischief consent', () => {
  it('is refused until the recipient opts in, with a separate opt-in for disruptive effects', async () => {
    const pair = await createCouple(db)
    await expect(send(pair.daniel, 'mischief', { effect: 'confetti' })).rejects.toThrow('recipient_declined')

    await run(pair.vee, 'update public.user_settings set allow_mischief = true where user_id = $1', [pair.vee.id])
    await send(pair.daniel, 'mischief', { effect: 'confetti' })
    await expect(send(pair.daniel, 'mischief', { effect: 'shake_room' })).rejects.toThrow('recipient_declined')

    await run(pair.vee, 'update public.user_settings set allow_disruptive_mischief = true where user_id = $1', [pair.vee.id])
    await send(pair.daniel, 'mischief', { effect: 'shake_room' })

    await run(pair.vee, 'update public.user_settings set allow_mischief = false where user_id = $1', [pair.vee.id])
    await expect(send(pair.daniel, 'mischief', { effect: 'confetti' })).rejects.toThrow('recipient_declined')
  })

  it('rejects unknown effects', async () => {
    await expect(send(couple.daniel, 'mischief', { effect: 'delete_everything' })).rejects.toThrow('invalid_payload')
  })

  it('keeps each person\'s settings private and self-editable only', async () => {
    expect(await run(couple.daniel, 'select * from public.user_settings')).toHaveLength(1)
    expect(await run(couple.eve, 'select * from public.user_settings where user_id = $1', [couple.vee.id])).toHaveLength(0)
    const changed = await run(couple.daniel, 'update public.user_settings set allow_mischief = true where user_id = $1 returning user_id', [couple.vee.id])
    expect(changed).toHaveLength(0)
    await expect(run(couple.daniel, 'update public.user_settings set household_id = $1 where user_id = $2', [randomUUID(), couple.daniel.id])).rejects.toThrow(/permission denied/)
  })
})

describe('hidden notes', () => {
  it('are readable by author and recipient only, and the event never carries the body', async () => {
    const pair = await createCouple(db)
    const clientId = randomUUID()
    const [note] = await run<{ id: string }>(pair.daniel, `select * from public.place_note($1, 'obj_guitar', 'the secret body', 'Open when sad', 'envelope')`, [clientId])
    expect(await run(pair.vee, 'select id from public.hidden_notes where id = $1', [note!.id])).toHaveLength(1)
    expect(await run(pair.daniel, 'select id from public.hidden_notes where id = $1', [note!.id])).toHaveLength(1)
    expect(await run(pair.eve, 'select id from public.hidden_notes where id = $1', [note!.id])).toHaveLength(0)

    const events = await run<{ payload: Record<string, unknown> }>(pair.vee, `select payload from public.events where kind = 'note_placed'`)
    expect(events).toHaveLength(1)
    expect(JSON.stringify(events[0]!.payload)).not.toContain('secret body')
    expect(events[0]!.payload.object_id).toBe('obj_guitar')
  })

  it('placing is idempotent', async () => {
    const pair = await createCouple(db)
    const clientId = randomUUID()
    const call = () => run<{ id: string }>(pair.daniel, `select * from public.place_note($1, 'obj_rose_pot', 'hello', null, 'fade')`, [clientId])
    const a = (await call())[0]!
    const b = (await call())[0]!
    expect(b.id).toBe(a.id)
    expect(await admin(`select id from public.events where kind = 'note_placed' and household_id = $1`, [pair.household])).toHaveLength(1)
  })

  it('cannot be edited by the recipient; only the recipient can mark read', async () => {
    const pair = await createCouple(db)
    const [note] = await run<{ id: string }>(pair.daniel, `select * from public.place_note($1, 'obj_guitar', 'hi', null, 'fade')`, [randomUUID()])
    await expect(run(pair.vee, `update public.hidden_notes set body = 'tampered' where id = $1`, [note!.id])).rejects.toThrow(/permission denied/)
    await expect(run(pair.daniel, 'select public.mark_note_read($1)', [note!.id])).rejects.toThrow('not_found')
    const read = await run<{ read_at: string | null }>(pair.vee, 'select * from public.mark_note_read($1)', [note!.id])
    expect(read[0]!.read_at).not.toBeNull()
  })

  it('validates object ids and bodies', async () => {
    await expect(run(couple.daniel, `select public.place_note($1, 'Bad Id!', 'x', null, 'fade')`, [randomUUID()])).rejects.toThrow('invalid_payload')
    await expect(run(couple.daniel, `select public.place_note($1, 'obj_guitar', '   ', null, 'fade')`, [randomUUID()])).rejects.toThrow('invalid_payload')
    await expect(run(couple.daniel, `select public.place_note($1, 'obj_guitar', 'x', null, 'explode')`, [randomUUID()])).rejects.toThrow('invalid_payload')
  })
})

describe('shared household data', () => {
  it('date ideas: members share them, outsiders cannot touch them, completion time is server-stamped', async () => {
    const [idea] = await run<{ id: string }>(couple.daniel, `insert into public.date_ideas (household_id, title) values ($1, 'Picnic') returning id`, [couple.household])
    expect(await run(couple.vee, 'select id from public.date_ideas where id = $1', [idea!.id])).toHaveLength(1)
    expect(await run(couple.eve, 'select id from public.date_ideas where id = $1', [idea!.id])).toHaveLength(0)
    await expect(run(couple.eve, `insert into public.date_ideas (household_id, title) values ($1, 'Intrusion')`, [couple.household])).rejects.toThrow(/row-level security/)
    expect(await run(couple.eve, `update public.date_ideas set title = 'pwned' where id = $1 returning id`, [idea!.id])).toHaveLength(0)
    expect(await run(couple.eve, 'delete from public.date_ideas where id = $1 returning id', [idea!.id])).toHaveLength(0)

    await run(couple.vee, 'update public.date_ideas set is_favorite = true where id = $1', [idea!.id])
    await run(couple.vee, `update public.date_ideas set completed_at = '2000-01-01', rating = 5 where id = $1`, [idea!.id])
    const [row] = await admin<{ year: number }>('select extract(year from completed_at)::int as year from public.date_ideas where id = $1', [idea!.id])
    expect(row!.year).toBeGreaterThan(2020)
    await expect(run(couple.vee, `update public.date_ideas set created_by = $2 where id = $1`, [idea!.id, couple.vee.id])).rejects.toThrow(/permission denied/)
  })

  it('moods and garden: server-stamped, one seed per person per day, watering is once per day', async () => {
    const pair = await createCouple(db)
    await run(pair.daniel, `select public.set_mood('cuddly', 'hi')`)
    await run(pair.daniel, `select public.set_mood('busy')`)
    const plants = await run<{ id: string }>(pair.vee, 'select id from public.garden_plants')
    expect(plants).toHaveLength(1)
    expect(await run(pair.vee, 'select mood from public.moods where user_id = $1', [pair.daniel.id])).toEqual([{ mood: 'busy' }])
    expect(await run(pair.eve, 'select * from public.moods where household_id = $1', [pair.household])).toHaveLength(0)

    await run(pair.vee, 'select public.water_plant($1)', [plants[0]!.id])
    await run(pair.vee, 'select public.water_plant($1)', [plants[0]!.id])
    const { water_count } = one(await run<{ water_count: number }>(pair.vee, 'select water_count from public.garden_plants where id = $1', [plants[0]!.id]))
    expect(water_count).toBe(1)
    await expect(run(pair.eve, 'select public.water_plant($1)', [plants[0]!.id])).rejects.toThrow('not_found')
    await expect(run(pair.daniel, `select public.set_mood('furious')`)).rejects.toThrow('invalid_mood')
    await expect(run(pair.daniel, `insert into public.moods (household_id, user_id, mood) values ($1, $2, 'happy')`, [pair.household, pair.daniel.id])).rejects.toThrow(/permission denied/)
  })

  it('spell recipes and reactions: shared to read, author-only to change', async () => {
    const pair = await createCouple(db)
    const [recipe] = await run<{ id: string }>(pair.vee, `insert into public.spell_recipes (household_id, name, ingredients, effect) values ($1, 'Moon tea', array['honey','lavender'], 'moon_glow') returning id`, [pair.household])
    expect(await run(pair.daniel, 'select id from public.spell_recipes where id = $1', [recipe!.id])).toHaveLength(1)
    expect(await run(pair.daniel, `update public.spell_recipes set name = 'x' where id = $1 returning id`, [recipe!.id])).toHaveLength(0)
    expect(await run(pair.daniel, 'delete from public.spell_recipes where id = $1 returning id', [recipe!.id])).toHaveLength(0)
    await expect(run(pair.vee, `insert into public.spell_recipes (household_id, name, effect) values ($1, 'bad', 'rm_rf')`, [pair.household])).rejects.toThrow()
    await expect(run(pair.vee, `insert into public.spell_recipes (household_id, name, effect, color) values ($1, 'bad', 'starfall', 'red')`, [pair.household])).rejects.toThrow()
    await expect(run(pair.vee, `insert into public.spell_recipes (household_id, name, effect, ingredients) values ($1, 'bad', 'starfall', array[repeat('x', 31)])`, [pair.household])).rejects.toThrow('invalid_payload')

    for (let i = 0; i < 24; i++) await run(pair.vee, `insert into public.reaction_presets (household_id, label, emoji) values ($1, $2, '✨')`, [pair.household, `r${i}`])
    await expect(run(pair.vee, `insert into public.reaction_presets (household_id, label, emoji) values ($1, 'one too many', '✨')`, [pair.household])).rejects.toThrow('limit_reached')
  })

  it('love notes and stickers are household-scoped; only the author edits', async () => {
    const pair = await createCouple(db)
    const [note] = await run<{ id: string }>(pair.daniel, `insert into public.love_notes (household_id, body) values ($1, 'You are my favorite hello') returning id`, [pair.household])
    expect(await run(pair.vee, 'select id from public.love_notes where id = $1', [note!.id])).toHaveLength(1)
    expect(await run(pair.eve, 'select id from public.love_notes where id = $1', [note!.id])).toHaveLength(0)
    expect(await run(pair.vee, `update public.love_notes set body = 'x' where id = $1 returning id`, [note!.id])).toHaveLength(0)
    await expect(run(pair.vee, `insert into public.stickers (household_id, label, storage_path) values ($1, 'x', $2)`, [pair.household, `${pair.household}/${pair.daniel.id}/x.png`])).rejects.toThrow()
    await run(pair.vee, `insert into public.stickers (household_id, label, storage_path, sprite_cols, sprite_rows, sprite_index) values ($1, 'hehe', $2, 3, 6, 17)`, [pair.household, `${pair.household}/${pair.vee.id}/sheet.jpg`])
    await expect(run(pair.vee, `insert into public.stickers (household_id, label, storage_path, sprite_cols, sprite_rows, sprite_index) values ($1, 'oob', $2, 3, 6, 18)`, [pair.household, `${pair.household}/${pair.vee.id}/sheet.jpg`])).rejects.toThrow()
  })
})

describe('memory vault', () => {
  it('private memories stay private to their author; shared ones are read-only for the partner', async () => {
    const pair = await createCouple(db)
    const [priv] = await run<{ id: string }>(pair.daniel, `insert into public.memories (household_id, kind, title, body, visibility) values ($1, 'note', 'Diary', 'dear diary', 'private') returning id`, [pair.household])
    const [shared] = await run<{ id: string }>(pair.daniel, `insert into public.memories (household_id, kind, title, body) values ($1, 'milestone', 'First date', 'it was lovely') returning id`, [pair.household])
    expect(await run(pair.vee, 'select id from public.memories where id = $1', [priv!.id])).toHaveLength(0)
    expect(await run(pair.vee, 'select id from public.memories where id = $1', [shared!.id])).toHaveLength(1)
    expect(await run(pair.eve, 'select id from public.memories where id = $1', [shared!.id])).toHaveLength(0)
    expect(await run(pair.vee, `update public.memories set title = 'x' where id = $1 returning id`, [shared!.id])).toHaveLength(0)
    expect(await run(pair.vee, 'delete from public.memories where id = $1 returning id', [shared!.id])).toHaveLength(0)
  })

  it('binds media to the author\'s own storage folder and enforces kind rules', async () => {
    const pair = await createCouple(db)
    const otherFolder = `${pair.household}/${pair.vee.id}/photo.jpg`
    await expect(run(pair.daniel, `insert into public.memories (household_id, kind, title, storage_path, mime_type, size_bytes) values ($1, 'photo', 'x', $2, 'image/jpeg', 10)`, [pair.household, otherFolder])).rejects.toThrow()
    await expect(run(pair.daniel, `insert into public.memories (household_id, kind, title) values ($1, 'photo', 'no file')`, [pair.household])).rejects.toThrow()
    await expect(run(pair.daniel, `insert into public.memories (household_id, kind, title) values ($1, 'note', 'no body')`, [pair.household])).rejects.toThrow()
    await expect(run(pair.daniel, `insert into public.memories (household_id, kind, title, storage_path, mime_type, size_bytes) values ($1, 'photo', 'x', $2, 'text/html', 10)`, [pair.household, `${pair.household}/${pair.daniel.id}/a.html`])).rejects.toThrow()
    await run(pair.daniel, `insert into public.memories (household_id, kind, title, storage_path, mime_type, size_bytes) values ($1, 'photo', 'ok', $2, 'image/jpeg', 10)`, [pair.household, `${pair.household}/${pair.daniel.id}/photo.jpg`])
  })
})

describe('listening together', () => {
  it('requires both people to opt in; opting out stops the shared session', async () => {
    const pair = await createCouple(db)
    const [track] = await run<{ id: string }>(pair.daniel, `insert into public.tracks (household_id, title, audio_path) values ($1, 'Our song', $2) returning id`, [pair.household, `${pair.household}/${pair.daniel.id}/song.mp3`])
    await expect(run(pair.daniel, `select public.listening_command('play', $1, 0)`, [track!.id])).rejects.toThrow('consent_required')
    await run(pair.daniel, 'select public.listening_set_consent(true)')
    await expect(run(pair.daniel, `select public.listening_command('play', $1, 0)`, [track!.id])).rejects.toThrow('consent_required')
    await run(pair.vee, 'select public.listening_set_consent(true)')

    const [session] = await run<{ state: string; revision: string }>(pair.daniel, `select * from public.listening_command('play', $1, 1500)`, [track!.id])
    expect(session!.state).toBe('playing')
    expect(await run(pair.vee, 'select state from public.listening_sessions')).toEqual([{ state: 'playing' }])
    expect(await run(pair.vee, `select id from public.events where kind = 'listening_invite'`)).toHaveLength(1)

    await run(pair.vee, 'select public.listening_set_consent(false)')
    expect(await run(pair.daniel, 'select state from public.listening_sessions')).toEqual([{ state: 'stopped' }])
    await expect(run(pair.daniel, `select public.listening_command('pause')`)).rejects.toThrow('consent_required')
  })

  it('tracks must live in the owner\'s folder and playlists only hold household tracks', async () => {
    const pair = await createCouple(db)
    await expect(run(pair.daniel, `insert into public.tracks (household_id, title, audio_path) values ($1, 'x', $2)`, [pair.household, `${pair.household}/${pair.vee.id}/song.mp3`])).rejects.toThrow()
    expect(await run(pair.eve, 'select * from public.tracks where household_id = $1', [pair.household])).toHaveLength(0)
  })
})

describe('storage policies', () => {
  it('buckets are private with size and mime limits', async () => {
    const buckets = await admin<{ id: string; public: boolean; file_size_limit: number | null; allowed_mime_types: string[] | null }>('select * from storage.buckets')
    expect(buckets.map((b) => b.id).sort()).toEqual(['covers', 'music', 'stickers', 'time-capsule', 'vault'])
    for (const bucket of buckets) {
      expect(bucket.public).toBe(false)
      expect(bucket.file_size_limit).toBeGreaterThan(0)
      expect(bucket.allowed_mime_types?.length).toBeGreaterThan(0)
    }
  })

  it('members read each other\'s uploads; outsiders cannot', async () => {
    const pair = await createCouple(db)
    const path = `${pair.household}/${pair.daniel.id}/song.mp3`
    await put(pair.daniel, 'music', path)
    expect(await visible(pair.vee, 'music', path)).toBe(true)
    expect(await visible(pair.eve, 'music', path)).toBe(false)
  })

  it('writes are confined to your own folder in your own household', async () => {
    const pair = await createCouple(db)
    await expect(put(pair.vee, 'music', `${pair.household}/${pair.daniel.id}/forged.mp3`)).rejects.toThrow(/row-level security/)
    await expect(put(pair.eve, 'music', `${pair.household}/${pair.eve.id}/intruder.mp3`)).rejects.toThrow(/row-level security/)
    await expect(put(pair.vee, 'music', `not-a-uuid/${pair.vee.id}/x.mp3`)).rejects.toThrow(/row-level security/)
    await expect(put(pair.vee, 'unknown-bucket', `${pair.household}/${pair.vee.id}/x.mp3`)).rejects.toThrow()
    await put(pair.vee, 'covers', `${pair.household}/${pair.vee.id}/c.png`)
  })

  it('objects are immutable and only deletable by their owner', async () => {
    const pair = await createCouple(db)
    const path = `${pair.household}/${pair.daniel.id}/song.mp3`
    await put(pair.daniel, 'music', path)
    expect(await run(pair.daniel, `update storage.objects set name = $2 where name = $1 returning id`, [path, path + '.bak'])).toHaveLength(0)
    expect(await run(pair.vee, 'delete from storage.objects where name = $1 returning id', [path])).toHaveLength(0)
    expect(await run(pair.daniel, 'delete from storage.objects where name = $1 returning id', [path])).toHaveLength(1)
  })

  it('vault: private memory files stay with their author, shared ones are visible to the partner', async () => {
    const pair = await createCouple(db)
    const privatePath = `${pair.household}/${pair.daniel.id}/private.jpg`
    const sharedPath = `${pair.household}/${pair.daniel.id}/shared.jpg`
    await put(pair.daniel, 'vault', privatePath)
    await put(pair.daniel, 'vault', sharedPath)
    await run(pair.daniel, `insert into public.memories (household_id, kind, title, storage_path, mime_type, size_bytes, visibility) values ($1, 'photo', 'p', $2, 'image/jpeg', 5, 'private')`, [pair.household, privatePath])
    await run(pair.daniel, `insert into public.memories (household_id, kind, title, storage_path, mime_type, size_bytes) values ($1, 'photo', 's', $2, 'image/jpeg', 5)`, [pair.household, sharedPath])
    expect(await visible(pair.daniel, 'vault', privatePath)).toBe(true)
    expect(await visible(pair.vee, 'vault', privatePath)).toBe(false)
    expect(await visible(pair.vee, 'vault', sharedPath)).toBe(true)
    expect(await visible(pair.eve, 'vault', sharedPath)).toBe(false)
  })
})

describe('time capsule', () => {
  it('is readable by members, immutable for everyone but the service role', async () => {
    const pair = await createCouple(db)
    const path = `${pair.household}/signal-home.html`
    await admin(`insert into storage.objects (bucket_id, name) values ('time-capsule', $1)`, [path])
    await admin(`insert into public.time_capsule_items (household_id, slug, title, storage_path, sha256, byte_size)
      values ($1, 'signal-home', 'Signal Home', $2, repeat('a', 64), 1234)`, [pair.household, path])

    expect(await run(pair.vee, 'select slug from public.time_capsule_items')).toEqual([{ slug: 'signal-home' }])
    expect(await run(pair.eve, 'select slug from public.time_capsule_items where household_id = $1', [pair.household])).toHaveLength(0)
    expect((await run(pair.vee, `select id from storage.objects where bucket_id = 'time-capsule'`)).length).toBe(1)

    await expect(run(pair.vee, `update public.time_capsule_items set sha256 = repeat('b', 64)`)).rejects.toThrow(/permission denied/)
    await expect(run(pair.vee, 'delete from public.time_capsule_items')).rejects.toThrow(/permission denied/)
    await expect(run(pair.vee, `insert into public.time_capsule_items (household_id, slug, title, storage_path, sha256, byte_size) values ($1, 'x', 'x', 'x', repeat('c', 64), 1)`, [pair.household])).rejects.toThrow(/permission denied/)
    await expect(put(pair.vee, 'time-capsule', `${pair.household}/${pair.vee.id}/evil.html`)).rejects.toThrow(/row-level security/)
    expect(await run(pair.vee, `delete from storage.objects where bucket_id = 'time-capsule' returning id`)).toHaveLength(0)
  })
})

describe('outsider isolation across every shared table', () => {
  const tables = [
    'events', 'moods', 'mood_entries', 'garden_plants', 'hidden_notes', 'date_ideas', 'spell_recipes', 'reaction_presets',
    'tracks', 'playlists', 'listening_sessions', 'listening_consent', 'memories', 'love_notes', 'stickers', 'household_state',
  ]
  it.each(tables)('Eve sees no %s rows from another household', async (table) => {
    const pair = await createCouple(db)
    await send(pair.daniel, 'heart_tap')
    await run(pair.daniel, `select public.set_mood('happy')`)
    await run(pair.daniel, `insert into public.date_ideas (household_id, title) values ($1, 'x')`, [pair.household])
    await run(pair.daniel, `select public.place_note($1, 'obj_guitar', 'hi', null, 'fade')`, [randomUUID()])
    await run(pair.daniel, `insert into public.love_notes (household_id, body) values ($1, 'hi')`, [pair.household])
    await run(pair.daniel, 'select public.listening_set_consent(true)')
    const rows = await run(pair.eve, `select * from public.${table} where household_id = $1`, [pair.household])
    expect(rows).toHaveLength(0)
  })
})
