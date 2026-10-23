/**
 * Client ↔ server contract.
 *
 * Statically extracts every API call the browser code makes (`api.get('/x')`, `api.raw('PUT', '/files/…')`) and
 * checks each one against the server's real route table, including the method. A typo in a path, or a call to an
 * endpoint that was renamed or removed, fails here instead of in somebody's browser.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../server/app'
import { WATCHED_TABLES } from '@/data/sync'

const src = join(import.meta.dirname, '..', '..', 'src')
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]))
const files = walk(src).filter((file) => /\.(ts|vue)$/.test(file))

const METHODS: Record<string, string> = { get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', del: 'DELETE' }

interface Call {
  file: string
  method: string
  path: string
}

function extractCalls(): Call[] {
  const calls: Call[] = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/\bapi\.(get|post|put|patch|del)(?:<[^>(]*>)?\(\s*([`'])([^`']*)\2/g)) {
      calls.push({ file, method: METHODS[match[1]!]!, path: match[3]! })
    }
    for (const match of text.matchAll(/\bapi\.raw\(\s*'([A-Z]+)'\s*,\s*([`'])([^`']*)\2/g)) {
      calls.push({ file, method: match[1]!, path: match[3]! })
    }
  }
  return calls
}

/** `/files/${id}/chunks/${n}?x=1` → `/files/X/chunks/X` */
const normalise = (path: string): string => path.replace(/\?.*$/, '').replace(/\$\{[^}]*\}/g, 'X')

const routeMatches = (method: string, path: string): boolean =>
  ROUTES.some((route) => route.method === method && new RegExp(`^${route.pattern.replace(/:[a-zA-Z]+/g, '[^/]+')}$`).test(path))

describe('client ↔ server contract', () => {
  const calls = extractCalls()

  it('finds the client calls it is supposed to check', () => {
    expect(calls.length).toBeGreaterThan(40)
  })

  it('every call the browser makes hits a route that exists, with the right method', () => {
    const missing = calls.filter((call) => !routeMatches(call.method, normalise(call.path))).map((call) => `${call.method} ${call.path}  (${call.file.replace(src, 'src')})`)
    expect(missing).toEqual([])
  })

  it('the long-poll and clock endpoints the sync hub uses exist', () => {
    expect(routeMatches('GET', '/sync')).toBe(true)
    expect(routeMatches('GET', '/time')).toBe(true)
    expect(routeMatches('POST', '/pulse')).toBe(true)
  })

  it('every collection the client watches is one the server bumps', () => {
    const serverSource = walk(join(import.meta.dirname, '..', '..', 'server')).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(f, 'utf8')).join('\n')
    const bumped = new Set([...serverSource.matchAll(/bump\(ctx,\s*([^)]*)\)/g)].flatMap((m) => [...m[1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]!)))
    const unwatched = WATCHED_TABLES.filter((table) => !bumped.has(table))
    expect(unwatched).toEqual([])
  })
})
