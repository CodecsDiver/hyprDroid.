/**
 * Browser stand-in for the two things the shared server code takes from `node:crypto`:
 * incremental SHA-1/SHA-256 (file fingerprints, store etags) and random UUIDs. Everything else is unused offline.
 */
import { Sha1, Sha256 } from './sha'

export function createHash(algorithm: 'sha1' | 'sha256'): { update(bytes: Uint8Array): unknown; digest(encoding: 'hex'): string } {
  const hash = algorithm === 'sha1' ? new Sha1() : new Sha256()
  const api = {
    update(bytes: Uint8Array) {
      hash.update(bytes)
      return api
    },
    digest(_encoding: 'hex') {
      return hash.hex()
    },
  }
  return api
}

export function randomUUID(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
