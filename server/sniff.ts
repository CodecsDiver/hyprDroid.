/** Content sniffing: the bytes must look like what the upload claims to be (clients can lie about MIME types). */

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0): boolean => signature.every((b, i) => bytes[offset + i] === b)
const ascii = (bytes: Uint8Array, text: string, offset = 0): boolean => [...text].every((c, i) => bytes[offset + i] === c.charCodeAt(0))

export function looksLike(bytes: Uint8Array, mime: string): boolean {
  switch (mime) {
    case 'image/jpeg': return startsWith(bytes, [0xff, 0xd8, 0xff])
    case 'image/png': return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/webp': return ascii(bytes, 'RIFF') && ascii(bytes, 'WEBP', 8)
    case 'image/heic': return ascii(bytes, 'ftyp', 4)
    case 'audio/mpeg': return ascii(bytes, 'ID3') || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)
    case 'audio/aac': return bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xf0) === 0xf0
    case 'audio/mp4': return ascii(bytes, 'ftyp', 4)
    case 'audio/ogg': return ascii(bytes, 'OggS')
    case 'audio/wav': return ascii(bytes, 'RIFF') && ascii(bytes, 'WAVE', 8)
    case 'audio/webm': return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])
    case 'audio/flac': return ascii(bytes, 'fLaC')
    case 'text/html': {
      const text = new TextDecoder().decode(bytes.slice(0, 512)).replace(/^﻿/, '').trimStart().toLowerCase()
      return text.startsWith('<!doctype html') || text.startsWith('<html') || text.startsWith('<')
    }
    default: return false
  }
}
