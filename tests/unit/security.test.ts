import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildLoadMessage, isViewerReady, sandboxIsSafe, sha256Hex, VIEWER_SANDBOX, verifyArchive } from '@/capsule/integrity'
import { AppError, toAppError } from '@/data/errors'
import { validateUpload } from '@/data/files'
import { describeEvent, summariseEvents } from '@/domain/eventText'
import type { LoveEvent } from '@/domain/events'
import { relativeTime } from '@/domain/time'

const root = join(import.meta.dirname, '..', '..')
describe('HTTP security headers', () => {
  const headers = readFileSync(join(root, 'public', '_headers'), 'utf8')
  const block = (pattern: string): string => {
    const start = headers.indexOf(`\n${pattern}\n`)
    expect(start, `rule for ${pattern}`).toBeGreaterThanOrEqual(0)
    const rest = headers.slice(start + pattern.length + 2)
    return rest.slice(0, rest.search(/\n\S/) === -1 ? undefined : rest.search(/\n\S/))
  }
  const csp = (text: string): string => /Content-Security-Policy: (.*)/.exec(text)?.[1] ?? ''

  it('the app policy allows no inline or eval script, no framing and no plugins', () => {
    const policy = csp(block('/*'))
    expect(policy).toMatch(/script-src 'self'(;|$)/)
    expect(policy).not.toMatch(/unsafe-eval/)
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/)
    expect(policy).toMatch(/frame-ancestors 'none'/)
    expect(policy).toMatch(/object-src 'none'/)
    expect(policy).toMatch(/base-uri 'none'/)
    expect(policy).toMatch(/default-src 'self'/)
  })

  it('the app may only talk to its own origin', () => {
    const policy = csp(block('/*'))
    expect(policy).toMatch(/connect-src 'self'(;|$)/)
    expect(policy).toMatch(/img-src 'self' data: blob:(;|$)/)
    expect(policy).toMatch(/media-src 'self' blob:(;|$)/)
    expect(policy).not.toMatch(/https?:\/\//)
  })

  it('only the capsule viewer gets the relaxed policy', () => {
    const viewer = csp(block('/capsule-viewer.html'))
    expect(viewer).toMatch(/default-src 'none'/)
    expect(viewer).toMatch(/unsafe-inline/)
    expect(csp(block('/*'))).not.toMatch(/unpkg/)
  })
})

describe('Time Capsule integrity and sandbox', () => {
  it('hashes bytes exactly and refuses any modification', async () => {
    const original = new TextEncoder().encode('<html>archived</html>')
    const good = await sha256Hex(original)
    expect(good).toMatch(/^[0-9a-f]{64}$/)
    expect(await verifyArchive(original, good)).toEqual({ ok: true, sha256: good })
    const tampered = new TextEncoder().encode('<html>archived!</html>')
    const result = await verifyArchive(tampered, good)
    expect(result.ok).toBe(false)
    expect((await verifyArchive(original, good.toUpperCase())).ok).toBe(true)
  })

  it('matches the well-known SHA-256 test vector', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('never grants the archived page the app origin', () => {
    expect(VIEWER_SANDBOX).toBe('allow-scripts')
    expect(sandboxIsSafe(VIEWER_SANDBOX)).toBe(true)
    expect(sandboxIsSafe('allow-scripts allow-same-origin')).toBe(false)
    expect(sandboxIsSafe('allow-scripts allow-top-navigation')).toBe(false)
    expect(sandboxIsSafe('allow-same-origin')).toBe(false)
  })

  it('speaks a tiny, strict protocol with the viewer', () => {
    expect(isViewerReady({ type: 'ready' })).toBe(true)
    expect(isViewerReady({ type: 'load' })).toBe(false)
    expect(isViewerReady(null)).toBe(false)
    expect(buildLoadMessage('<p>x</p>', 'T'.repeat(500)).title).toHaveLength(120)
  })

  it('the viewer page checks the sender and never ships the app origin', () => {
    const viewer = readFileSync(join(root, 'public', 'capsule-viewer.js'), 'utf8')
    expect(viewer).toMatch(/event\.source !== window\.parent/)
    expect(viewer).toMatch(/setAttribute\('sandbox', 'allow-scripts'\)/)
    expect(viewer).not.toMatch(/allow-same-origin/)
  })
})

describe('private content never enters git', () => {
  it('ignores ./private and tracks nothing from it', () => {
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toMatch(/^private\/$/m)
    const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n')
    expect(tracked.filter((file) => file.startsWith('private/'))).toEqual([])
    expect(tracked.filter((file) => /\.(mp3|wav|m4a|flac)$/i.test(file))).toEqual([])
    expect(tracked.filter((file) => /^\.env(\.|$)/.test(file) && file !== '.env.example')).toEqual([])
  })

  it('the repository contains no secret-shaped values', () => {
    const tracked = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\n').filter((f) => /\.(ts|vue|mjs|mts|js|md|json|html|css|toml)$/.test(f) && !f.startsWith('package-lock') && existsSync(join(root, f)))
    for (const file of tracked) {
      const text = readFileSync(join(root, file), 'utf8')
      expect(/eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/.test(text), `${file} contains a JWT-shaped secret`).toBe(false)
      expect(/SIGNAL_(SESSION_SECRET|ADMIN_TOKEN)\s*=\s*[0-9a-f]{32,}/i.test(text), `${file} contains a server secret`).toBe(false)
      expect(/pbkdf2\$sha256\$\d+\$[A-Za-z0-9+/=]{20,}\$[A-Za-z0-9+/=]{40,}/.test(text) && !file.startsWith('tests/'), `${file} contains a password hash`).toBe(false)
    }
  })
})

describe('upload validation', () => {
  const file = (type: string, size: number): Blob => new Blob([new Uint8Array(Math.min(size, 1024))], { type }) // size checked below via defineProperty
  it('allows expected types and rejects scripts, HTML and oversize files', () => {
    expect(validateUpload('cover', file('image/png', 10))).toEqual({ mime: 'image/png' })
    expect(() => validateUpload('cover', file('text/html', 10))).toThrow(AppError)
    expect(() => validateUpload('music', file('application/javascript', 10))).toThrow(AppError)
    expect(() => validateUpload('sticker', file('image/svg+xml', 10))).toThrow(AppError) // SVG can carry script
    expect(() => validateUpload('vault', new Blob([], { type: 'image/png' }))).toThrow(/empty/)
    const big = new Blob([new Uint8Array(1024)], { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 })
    expect(() => validateUpload('cover', big)).toThrow(/larger/)
  })
})

describe('error mapping', () => {
  it('maps server error codes, permission failures and network failures', () => {
    expect(toAppError({ message: 'recipient_declined' }).code).toBe('recipient_declined')
    expect(toAppError({ message: 'recipient_declined' }).retryable).toBe(false)
    expect(toAppError({ message: 'rate_limited' }).retryable).toBe(true)
    expect(toAppError({ message: 'permission', status: 403 }).code).toBe('permission')
    expect(toAppError({ message: 'invalid_credentials', status: 401 }).code).toBe('invalid_credentials')
    expect(toAppError(new TypeError('Failed to fetch')).code).toBe('network')
    expect(toAppError(new TypeError('Failed to fetch')).retryable).toBe(true)
    expect(toAppError('weird').code).toBe('unknown')
  })
})

describe('event wording and relative time', () => {
  const event = (kind: string, payload: object): LoveEvent => ({
    id: 'i', senderId: 's', recipientId: 'r', clientEventId: 'c', kind, payload, createdAt: '', expiresAt: '', seenAt: null,
  }) as LoveEvent

  it('describes events and summarises a digest', () => {
    expect(describeEvent(event('love_ping', { reaction: 'kiss' }), 'Daniel').text).toBe('Daniel sent you a kiss')
    expect(describeEvent(event('love_ping', { reaction: 'custom', label: 'Pizza?', emoji: '🍕' }), 'Daniel')).toEqual({ emoji: '🍕', text: 'Daniel sent “Pizza?”' })
    expect(summariseEvents([{ kind: 'love_ping' }, { kind: 'heart_tap' }, { kind: 'hug' }, { kind: 'note_placed' }, { kind: 'note_placed' }])).toBe('2 pings, 1 hug, 2 hidden notes')
  })

  it('formats relative time', () => {
    const now = Date.parse('2025-06-01T12:00:00Z')
    expect(relativeTime('2025-06-01T11:59:50Z', now)).toBe('just now')
    expect(relativeTime('2025-06-01T11:30:00Z', now)).toMatch(/30 minutes ago/)
    expect(relativeTime('nonsense', now)).toBe('')
  })
})
