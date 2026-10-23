export function sha256(buffer: Uint8Array): string
export function extractStringArray(source: string, name: string): string[]
export function extractDataUri(source: string, mimePrefix: string): { mime: string; bytes: Buffer } | null
export function detectKind(html: string): 'signal-home' | 'love-universe' | null
export function looksLike(bytes: Uint8Array, kind: 'jpeg' | 'mp3'): boolean
export const STICKER_SHEET: { cols: number; rows: number; labels: string[] }
export const CAPSULE_ITEMS: Record<string, { slug: string; title: string; description: string }>
export interface ManifestEntry { sha256: string; bytes: number }
export interface PlanStep {
  type: 'capsule' | 'sticker-sheet' | 'track'
  bucket: string
  path: string
  source: string
  contentType: string
  sha256: string
  bytes: number
  item?: { slug: string; title: string; description: string }
}
export function buildUploadPlan(input: { household: string; author: string; manifest: { files: Record<string, ManifestEntry> } }): PlanStep[]
