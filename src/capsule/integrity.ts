import viewerScript from './viewer.js?raw'

/**
 * Time Capsule integrity + viewer protocol.
 *
 * The originals are stored byte-for-byte in this browser's storage, and their SHA-256
 * is recorded when they are archived (the archive refuses any later change). Before anything
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

/** Messages between the app and the capsule viewer (a sandboxed iframe with an opaque origin). */
export interface ViewerReadyMessage {
  type: 'ready'
}
export interface ViewerLoadMessage {
  type: 'load'
  html: string
  title: string
  /** Let the archived page reach the internet (it was built to load fonts and a 3D library). Off by default. */
  online: boolean
}

export function isViewerReady(data: unknown): data is ViewerReadyMessage {
  return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === 'ready'
}

export function buildLoadMessage(html: string, title: string, online = false): ViewerLoadMessage {
  return { type: 'load', html, title: title.slice(0, 120), online }
}

/** The iframe sandbox must never include allow-same-origin: that would let the legacy page reach the app's session. */
export const VIEWER_SANDBOX = 'allow-scripts'
export function sandboxIsSafe(sandbox: string): boolean {
  const tokens = sandbox.split(/\s+/).filter(Boolean)
  return tokens.includes('allow-scripts') && !tokens.includes('allow-same-origin') && !tokens.includes('allow-top-navigation') && !tokens.includes('allow-popups-to-escape-sandbox')
}

/**
 * The viewer page, built into the app as a string so the app can be a single file. It is shown through `srcdoc` inside an
 * iframe sandboxed without `allow-same-origin`, so it (and the archived page it hosts) cannot reach the app or its storage.
 */
export const VIEWER_DOCUMENT = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"><title>Time Capsule viewer</title><style>html,body{margin:0;height:100%;background:#080008}iframe{border:0;width:100%;height:100%;display:block;background:#080008}</style></head><body><script>${viewerScript.replace(/<\/script/gi, '<\\/script')}</script></body></html>`
