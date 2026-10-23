/**
 * Time Capsule integrity + viewer protocol.
 *
 * The originals are stored byte-for-byte in a private bucket, and their SHA-256
 * is recorded in the database (write-protected from clients). Before anything
 * is shown, the downloaded bytes are hashed and compared, so a swapped or
 * corrupted file is refused rather than displayed.
 */

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  // Copy into a plain ArrayBuffer so the digest input is never a shared/offset view.
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export type IntegrityResult = { ok: true; sha256: string } | { ok: false; expected: string; actual: string }

export async function verifyArchive(data: ArrayBuffer | Uint8Array, expectedSha256: string): Promise<IntegrityResult> {
  const actual = await sha256Hex(data)
  return actual === expectedSha256.toLowerCase() ? { ok: true, sha256: actual } : { ok: false, expected: expectedSha256, actual }
}

/** Messages between the app and /capsule-viewer.html (sandboxed, opaque origin). */
export interface ViewerReadyMessage {
  type: 'ready'
}
export interface ViewerLoadMessage {
  type: 'load'
  html: string
  title: string
}

export function isViewerReady(data: unknown): data is ViewerReadyMessage {
  return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === 'ready'
}

export function buildLoadMessage(html: string, title: string): ViewerLoadMessage {
  return { type: 'load', html, title: title.slice(0, 120) }
}

/** The iframe sandbox must never include allow-same-origin: that would let the legacy page reach the app's session. */
export const VIEWER_SANDBOX = 'allow-scripts'
export function sandboxIsSafe(sandbox: string): boolean {
  const tokens = sandbox.split(/\s+/).filter(Boolean)
  return tokens.includes('allow-scripts') && !tokens.includes('allow-same-origin') && !tokens.includes('allow-top-navigation') && !tokens.includes('allow-popups-to-escape-sandbox')
}
