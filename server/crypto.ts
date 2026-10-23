import { createHmac, pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const pbkdf2Async = promisify(pbkdf2)

export const PBKDF2_ITERATIONS = 310_000

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** `pbkdf2$sha256$<iterations>$<salt b64>$<hash b64>` */
export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = randomBytes(16)
  const hash = await pbkdf2Async(password, salt, iterations, 32, 'sha256')
  return `pbkdf2$sha256$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`
}

const DUMMY_HASH = `pbkdf2$sha256$1000$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(32).toString('base64')}`

/** Always does the work, even for an unknown user, so timing does not reveal which names exist. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = (stored ?? DUMMY_HASH).split('$')
  const [scheme, digest, iterationsText, saltB64, hashB64] = parts
  const iterations = Number(iterationsText)
  if (parts.length !== 5 || scheme !== 'pbkdf2' || digest !== 'sha256' || !Number.isInteger(iterations) || iterations < 1000 || iterations > 5_000_000) return false
  const expected = Buffer.from(hashB64 ?? '', 'base64')
  const actual = await pbkdf2Async(password, Buffer.from(saltB64 ?? '', 'base64'), iterations, expected.length || 32, 'sha256')
  const ok = expected.length === actual.length && timingSafeEqual(expected, actual)
  return stored !== null && ok
}

const b64url = (input: Buffer | string): string => Buffer.from(input).toString('base64url')

export interface TokenPayload {
  /** user id */
  u: string
  /** expiry, seconds since epoch */
  e: number
}

export function signToken(payload: TokenPayload, secret: string): string {
  const body = b64url(JSON.stringify(payload))
  const mac = createHmac('sha256', secret).update(body).digest()
  return `${body}.${b64url(mac)}`
}

export function verifyToken(token: string, secret: string, nowMs: number): TokenPayload | null {
  const [body, mac, extra] = token.split('.')
  if (!body || !mac || extra !== undefined) return null
  const expected = createHmac('sha256', secret).update(body).digest()
  const given = Buffer.from(mac, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Partial<TokenPayload>
    if (typeof payload.u !== 'string' || typeof payload.e !== 'number' || payload.e * 1000 <= nowMs) return null
    return { u: payload.u, e: payload.e }
  } catch {
    return null
  }
}

export const randomHex = (bytes = 32): string => randomBytes(bytes).toString('hex')
