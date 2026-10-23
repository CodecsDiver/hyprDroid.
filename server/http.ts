export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly hint?: string) {
    super(code)
  }
}

export const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-resource-policy': 'same-origin',
}

export function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SECURITY_HEADERS, ...init.headers },
  })
}

export function errorResponse(error: ApiError): Response {
  return json({ error: { code: error.code, ...(error.hint ? { hint: error.hint } : {}) } }, { status: error.status })
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim()
  }
  return out
}

export const SESSION_COOKIE = 'sh_session'
export const SESSION_SECONDS = 30 * 24 * 3600

export function sessionCookie(token: string, secure: boolean, maxAge = SESSION_SECONDS): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

/** Reads a request body, refusing anything larger than `limit` bytes (checked while reading, not just from the header). */
export async function readBytes(request: Request, limit: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > limit) throw new ApiError(413, 'too_large')
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel()
      throw new ApiError(413, 'too_large')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

export const JSON_BODY_LIMIT = 64 * 1024

export async function readJson(request: Request): Promise<unknown> {
  const bytes = await readBytes(request, JSON_BODY_LIMIT)
  try {
    return bytes.length === 0 ? {} : JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new ApiError(400, 'invalid_payload', 'json')
  }
}
