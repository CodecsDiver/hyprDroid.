/**
 * Client ↔ database contract.
 *
 * The browser talks to PostgREST, which this suite cannot run. Instead it statically extracts every
 * RPC call and every table/column the client code uses and checks them against the REAL migrated
 * schema and the privileges of the `authenticated` role. A typo in a column name, an argument name,
 * or a write to a column the role cannot touch fails here rather than in production.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { WATCHED_TABLES } from '@/data/realtime'
import { createDatabase } from './harness'

const src = join(import.meta.dirname, '..', '..', 'src')
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]))
const files = walk(join(src, 'data')).concat(walk(join(src, 'state'))).filter((file) => file.endsWith('.ts'))

let db: PGlite
beforeAll(async () => {
  db = await createDatabase()
}, 60_000)

/** Text of the first {...} object literal at/after `from`, matched by brace depth. */
function objectLiteral(text: string, from: number): string | null {
  const open = text.indexOf('{', from)
  if (open < 0) return null
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) return text.slice(open, i + 1)
  }
  return null
}

/** Keys written at depth 1 of an object literal (`a: x`, shorthand `a,`, and spread-conditionals are ignored). */
function topLevelKeys(literal: string): string[] {
  const keys: string[] = []
  let depth = 0
  let token = ''
  for (let i = 0; i < literal.length; i++) {
    const ch = literal[i]!
    if ('{(['.includes(ch)) depth++
    else if ('})]'.includes(ch)) depth--
    if (depth === 1 && ch !== '{') token += ch
    if (depth === 1 && (ch === ',' || ch === '\n')) {
      const key = /^\s*([a-z_][a-z0-9_]*)\s*(:|,|$)/.exec(token.replace(/^[,\s]+/, ''))?.[1]
      if (key) keys.push(key)
      token = ''
    }
  }
  const last = /^\s*([a-z_][a-z0-9_]*)\s*(:|,|$)/.exec(token.replace(/^[,\s]+/, ''))?.[1]
  if (last) keys.push(last)
  return [...new Set(keys)]
}

interface Usage {
  file: string
  table: string
  insert: Set<string>
  update: Set<string>
  read: Set<string>
}

function extractUsage(): Usage[] {
  const usages: Usage[] = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const froms = [...text.matchAll(/from\('([a-z_]+)'\)/g)]
    froms.forEach((match, index) => {
      const start = match.index!
      const end = froms[index + 1]?.index ?? text.length
      const chunk = text.slice(start, end)
      const usage: Usage = { file, table: match[1]!, insert: new Set(), update: new Set(), read: new Set() }
      for (const op of chunk.matchAll(/\.(insert|update)\(/g)) {
        const literal = objectLiteral(chunk, op.index! + op[0].length)
        if (literal) topLevelKeys(literal).forEach((key) => (op[1] === 'insert' ? usage.insert : usage.update).add(key))
      }
      for (const sel of chunk.matchAll(/\.select\('([^']*)'\)/g)) {
        const columns = sel[1]!.replace(/[a-z_]+\([^)]*\)/g, '').split(',').map((c) => c.trim()).filter((c) => c && c !== '*')
        columns.forEach((column) => usage.read.add(column))
      }
      for (const filter of chunk.matchAll(/\.(?:eq|neq|is|gt|lt|gte|lte|in|order)\('([a-z_]+)'/g)) usage.read.add(filter[1]!)
      usages.push(usage)
    })
  }
  return usages
}

describe('table access matches the schema and role privileges', () => {
  it('finds the repository queries (guards against the extractor silently matching nothing)', () => {
    const usages = extractUsage()
    expect(usages.length).toBeGreaterThan(40)
    expect(usages.some((u) => u.table === 'date_ideas' && u.insert.has('household_id'))).toBe(true)
    expect(usages.some((u) => u.table === 'date_ideas' && u.update.has('is_favorite'))).toBe(true)
    expect(usages.some((u) => u.table === 'tracks' && u.insert.has('audio_path'))).toBe(true)
  })

  it('the settings mapper only writes columns the client role may update', async () => {
    // saveSettings builds its update object in toRow(), which the literal extractor cannot see.
    const text = readFileSync(join(src, 'data', 'repos', 'settings.ts'), 'utf8')
    const body = text.slice(text.indexOf('const toRow'), text.indexOf('const fromRow'))
    const columns = [...body.matchAll(/&& \{ ([a-z_]+):/g)].map((m) => m[1]!)
    expect(columns.length).toBe(8)
    for (const column of columns) expect(await privilege('user_settings', column, 'UPDATE'), column).toBe(true)
  })

  it('every table the client touches exists', async () => {
    const tables = [...new Set(extractUsage().map((u) => u.table))]
    const { rows } = await db.query<{ table_name: string }>(`select table_name from information_schema.tables where table_schema = 'public'`)
    const existing = new Set(rows.map((r) => r.table_name))
    expect(tables.filter((t) => !existing.has(t))).toEqual([])
  })

  const privilege = async (table: string, column: string, kind: 'SELECT' | 'INSERT' | 'UPDATE'): Promise<boolean | null> => {
    const exists = await db.query(`select 1 from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2`, [table, column])
    if (exists.rows.length === 0) return null
    const { rows } = await db.query<{ ok: boolean }>(`select has_column_privilege('authenticated', $1, $2, $3) as ok`, [`public.${table}`, column, kind])
    return rows[0]!.ok
  }

  it('every column the client reads or filters on exists and is selectable', async () => {
    const problems: string[] = []
    for (const usage of extractUsage()) {
      for (const column of usage.read) {
        const ok = await privilege(usage.table, column, 'SELECT')
        if (ok === null) problems.push(`${usage.file.split('/src/')[1]}: ${usage.table}.${column} does not exist`)
        else if (!ok) problems.push(`${usage.file.split('/src/')[1]}: ${usage.table}.${column} is not selectable by the client role`)
      }
    }
    expect(problems).toEqual([])
  })

  it('every column the client inserts exists and is insertable by the client role', async () => {
    const problems: string[] = []
    for (const usage of extractUsage()) {
      for (const column of usage.insert) {
        const ok = await privilege(usage.table, column, 'INSERT')
        if (ok !== true) problems.push(`${usage.file.split('/src/')[1]}: cannot insert ${usage.table}.${column} (${ok === null ? 'no such column' : 'no privilege'})`)
      }
    }
    expect(problems).toEqual([])
  })

  it('every column the client updates exists and is updatable by the client role', async () => {
    const problems: string[] = []
    for (const usage of extractUsage()) {
      for (const column of usage.update) {
        const ok = await privilege(usage.table, column, 'UPDATE')
        if (ok !== true) problems.push(`${usage.file.split('/src/')[1]}: cannot update ${usage.table}.${column} (${ok === null ? 'no such column' : 'no privilege'})`)
      }
    }
    expect(problems).toEqual([])
  })

  it('every realtime-watched table has the household_id column its filter relies on', async () => {
    for (const table of WATCHED_TABLES) expect(await privilege(table, 'household_id', 'SELECT'), table).toBe(true)
    const { rows } = await db.query<{ tablename: string }>(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'`)
    const published = new Set(rows.map((r) => r.tablename))
    expect([...WATCHED_TABLES, 'events'].filter((t) => !published.has(t))).toEqual([])
  })
})

describe('RPC calls match function signatures', () => {
  function extractRpcs(): { file: string; name: string; args: string[] }[] {
    const calls: { file: string; name: string; args: string[] }[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(/\.rpc\('([a-z_]+)'(?:,\s*(\{))?/g)) {
        const literal = match[2] ? objectLiteral(text, match.index! + match[0].length - 1) : null
        calls.push({ file, name: match[1]!, args: literal ? topLevelKeys(literal) : [] })
      }
    }
    return calls
  }

  it('finds the RPC calls', () => {
    const names = extractRpcs().map((c) => c.name)
    for (const expected of ['send_event', 'ack_events', 'set_mood', 'place_note', 'listening_command', 'create_household', 'accept_invite']) expect(names).toContain(expected)
  })

  it('every RPC exists, is callable by authenticated, and gets exactly its named parameters', async () => {
    const problems: string[] = []
    for (const call of extractRpcs()) {
      const { rows } = await db.query<{ args: string[] | null; required: number; total: number; callable: boolean }>(
        `select p.proargnames[(p.pronargs - p.pronargdefaults + 1):p.pronargs] as args,
                (p.pronargs - p.pronargdefaults) as required, p.pronargs as total,
                has_function_privilege('authenticated', p.oid, 'EXECUTE') as callable
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = $1`, [call.name])
      if (rows.length !== 1) { problems.push(`${call.name}: expected exactly one function, found ${rows.length}`); continue }
      if (!rows[0]!.callable) problems.push(`${call.name}: not executable by authenticated`)
      const { rows: names } = await db.query<{ arg_names: string[] }>(`select p.proargnames as arg_names from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [call.name])
      const all = names[0]!.arg_names ?? []
      const required = all.slice(0, rows[0]!.required)
      for (const arg of call.args) if (!all.includes(arg)) problems.push(`${call.file.split('/src/')[1]}: ${call.name}() has no parameter "${arg}"`)
      for (const arg of required) if (!call.args.includes(arg)) problems.push(`${call.file.split('/src/')[1]}: ${call.name}() requires "${arg}" but the client does not send it`)
    }
    expect(problems).toEqual([])
  })
})
