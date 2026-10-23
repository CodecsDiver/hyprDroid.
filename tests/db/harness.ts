import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const root = join(import.meta.dirname, '..', '..', 'supabase')

export interface Actor {
  id: string
  email: string
}

export async function createDatabase(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(readFileSync(join(root, 'tests', 'supabase_shim.sql'), 'utf8'))
  const files = readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(root, 'migrations', file), 'utf8'))
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`)
    }
  }
  return db
}

export async function createUser(db: PGlite, name: string): Promise<Actor> {
  const id = randomUUID()
  const email = `${name.toLowerCase()}-${id.slice(0, 6)}@example.test`
  await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
    id,
    email,
    JSON.stringify({ display_name: name }),
  ])
  return { id, email }
}

/** Runs `fn` with the Postgres role and JWT claims PostgREST would set for this caller. */
export async function as<T>(db: PGlite, actor: Actor | null, fn: () => Promise<T>): Promise<T> {
  const claims = actor ? { sub: actor.id, email: actor.email, role: 'authenticated' } : { role: 'anon' }
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(claims)])
  await db.exec(`set role ${actor ? 'authenticated' : 'anon'}`)
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
    await db.query(`select set_config('request.jwt.claims', '', false)`)
  }
}

export interface Couple {
  household: string
  daniel: Actor
  vee: Actor
  eve: Actor
}

/** A household with two members plus an unrelated outsider. */
export async function createCouple(db: PGlite): Promise<Couple> {
  const daniel = await createUser(db, 'Daniel')
  const vee = await createUser(db, 'Vee')
  const eve = await createUser(db, 'Eve')
  const household = await as(db, daniel, async () => {
    const { rows } = await db.query<{ id: string }>(`select public.create_household('Home') as id`)
    return rows[0]!.id
  })
  const token = await as(db, daniel, async () => {
    const { rows } = await db.query<{ t: string }>(`select public.invite_partner($1) as t`, [vee.email])
    return rows[0]!.t
  })
  await as(db, vee, () => db.query(`select public.accept_invite($1)`, [token]))
  // Eve gets her own household so she is a "real" authenticated user with data of her own.
  await as(db, eve, () => db.query(`select public.create_household('Eve place')`))
  return { household, daniel, vee, eve }
}
