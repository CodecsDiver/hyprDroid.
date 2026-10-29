import { friendly } from '../data/errors'
import { assertSafeKey } from '../../server/store'

/**
 * A backup is one JSON file holding everything this browser has stored for the home: every record and every file
 * (base64). Restoring replaces what is here. It never contains passwords or device information, because there are none.
 */
export const BACKUP_APP = 'signal-home'
export const BACKUP_VERSION = 1
/** Never saved or restored: these only describe who is here *right now*. */
const SKIP_PREFIXES = ['presence/']
const MAX_RESTORE_BYTES = 600 * 1024 * 1024

export type Entries = Iterable<[string, Uint8Array]>

function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(out)
}

const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

export function encodeBackup(entries: Entries, now = new Date()): Blob {
  const parts: string[] = [`{"app":"${BACKUP_APP}","version":${BACKUP_VERSION},"createdAt":${JSON.stringify(now.toISOString())},"entries":{`]
  let first = true
  for (const [key, bytes] of entries) {
    if (SKIP_PREFIXES.some((prefix) => key.startsWith(prefix))) continue
    parts.push(`${first ? '' : ','}${JSON.stringify(key)}:"${toBase64(bytes)}"`)
    first = false
  }
  parts.push('}}')
  return new Blob(parts, { type: 'application/json' })
}

export interface DecodedBackup {
  createdAt: string
  entries: Map<string, Uint8Array>
}

/** Reads and checks a backup. Throws a message fit to show a person; nothing is applied here. */
export function decodeBackup(text: string): DecodedBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw friendly('That file is not a Signal Home backup (it is not readable).')
  }
  const file = parsed as { app?: unknown; version?: unknown; createdAt?: unknown; entries?: unknown }
  if (typeof file !== 'object' || file === null || file.app !== BACKUP_APP) throw friendly('That file is not a Signal Home backup.')
  if (file.version !== BACKUP_VERSION) throw friendly('That backup was made by a different version and can not be restored here.')
  if (typeof file.entries !== 'object' || file.entries === null || Array.isArray(file.entries)) throw friendly('That backup is damaged (no data in it).')
  const entries = new Map<string, Uint8Array>()
  let total = 0
  for (const [key, value] of Object.entries(file.entries as Record<string, unknown>)) {
    try {
      assertSafeKey(key)
    } catch {
      throw friendly('That backup contains a record this app would never write, so it was not restored.')
    }
    if (typeof value !== 'string') throw friendly('That backup is damaged (a record is not readable).')
    let bytes: Uint8Array
    try {
      bytes = fromBase64(value)
    } catch {
      throw friendly('That backup is damaged (a record is not readable).')
    }
    total += bytes.length
    if (total > MAX_RESTORE_BYTES) throw friendly('That backup is larger than this app will restore.')
    if (!SKIP_PREFIXES.some((prefix) => key.startsWith(prefix))) entries.set(key, bytes)
  }
  return { createdAt: typeof file.createdAt === 'string' ? file.createdAt : '', entries }
}

export const backupFileName = (now = new Date()): string => `signal-home-backup-${now.toISOString().slice(0, 10)}.json`
