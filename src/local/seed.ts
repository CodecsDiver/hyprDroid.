/**
 * First-run content that is baked into a PRIVATE build (see scripts/build-private.mjs): the two original apps, the
 * sticker sheet, the room song and the written notes. The public build contains none of it.
 */
export interface PrivateSeed {
  capsule: { slug: string; title: string; description: string; b64: string }[]
  stickerSheet: { b64: string; cols: number; rows: number; labels: string[] } | null
  song: { b64: string } | null
  notes: { voice: 'love' | 'miss'; body: string }[]
}

export const bytesFromBase64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
