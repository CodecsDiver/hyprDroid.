import { createHash } from 'node:crypto'
import type { FileKind, FileMeta } from '../../src/shared/types'
import { ApiError } from '../http'
import { getValue, iso, requireObject, uuidParam } from '../lib'
import type { Ctx, Req, Router } from '../router'
import { looksLike } from '../sniff'

export const CHUNK_SIZE = 3 * 1024 * 1024

export const FILE_RULES: Record<FileKind, { maxBytes: number; mimes: readonly string[] }> = {
  music: { maxBytes: 40 * 1024 * 1024, mimes: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/flac'] },
  cover: { maxBytes: 3 * 1024 * 1024, mimes: ['image/jpeg', 'image/png', 'image/webp'] },
  vault: { maxBytes: 20 * 1024 * 1024, mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav'] },
  sticker: { maxBytes: 3 * 1024 * 1024, mimes: ['image/jpeg', 'image/png', 'image/webp'] },
  capsule: { maxBytes: 20 * 1024 * 1024, mimes: ['text/html'] },
}

interface Upload {
  ownerId: string
  kind: FileKind
  mime: string
  size: number
  createdAt: string
}

export const chunkKey = (id: string, n: number): string => `chunks/${id}/${String(n).padStart(4, '0')}`
const chunkCount = (size: number): number => Math.ceil(size / CHUNK_SIZE)

export async function getFile(ctx: Ctx, id: string): Promise<FileMeta | null> {
  return getValue<FileMeta>(ctx.store, `files/${id}`)
}

export async function deleteFile(ctx: Ctx, id: string): Promise<void> {
  const meta = await getFile(ctx, id)
  if (!meta || meta.kind === 'capsule') return
  for (let n = 0; n < meta.chunks; n++) await ctx.store.remove(chunkKey(id, n))
  await ctx.store.remove(`files/${id}`)
}

/** Who may read a file: both people for shared kinds; the owner (or anyone, once shared) for vault files. */
function canRead(meta: FileMeta, userId: string): boolean {
  return meta.kind !== 'vault' || meta.ownerId === userId || meta.shared
}

function parseRange(header: string | null, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid'
  let start: number
  let end: number
  if (m[1] === '') {
    const suffix = Number(m[2])
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  return start > end || start >= size ? 'invalid' : { start, end }
}

async function readSlice(ctx: Ctx, meta: FileMeta, start: number, end: number): Promise<Uint8Array> {
  const out = new Uint8Array(end - start + 1)
  let written = 0
  for (let n = Math.floor(start / CHUNK_SIZE); n <= Math.floor(end / CHUNK_SIZE); n++) {
    const chunk = await ctx.store.getBytes(chunkKey(meta.id, n))
    if (!chunk) throw new ApiError(500, 'file_corrupt')
    const from = Math.max(start, n * CHUNK_SIZE) - n * CHUNK_SIZE
    const to = Math.min(end, n * CHUNK_SIZE + chunk.length - 1) - n * CHUNK_SIZE
    out.set(chunk.subarray(from, to + 1), written)
    written += to - from + 1
  }
  return out
}

export function registerFiles(router: Router): void {
  // ---- start an upload
  router.post('/files', async (req: Req, ctx: Ctx) => {
    const body = requireObject(await req.json())
    const kind = body.kind as FileKind
    const rules = FILE_RULES[kind]
    if (!rules || typeof body.kind !== 'string') throw new ApiError(400, 'invalid_payload', 'kind')
    if (kind === 'capsule' && !req.admin) throw new ApiError(403, 'permission')
    const mime = typeof body.mime === 'string' ? body.mime.split(';')[0]!.trim().toLowerCase() : ''
    if (!rules.mimes.includes(mime)) throw new ApiError(400, 'invalid_payload', 'mime')
    const size = Number(body.size)
    if (!Number.isInteger(size) || size < 1) throw new ApiError(400, 'invalid_payload', 'size')
    if (size > rules.maxBytes) throw new ApiError(413, 'too_large')
    const id = ctx.uuid()
    await ctx.store.put(`upload/${id}`, { ownerId: req.user.id, kind, mime, size, createdAt: iso(ctx.now()) } satisfies Upload)
    return { id, chunkSize: CHUNK_SIZE, chunks: chunkCount(size) }
  })

  // ---- one chunk (raw bytes)
  router.put('/files/:id/chunks/:n', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const upload = await getValue<Upload>(ctx.store, `upload/${id}`)
    if (!upload || upload.ownerId !== req.user.id) throw new ApiError(404, 'not_found')
    const n = Number(req.params.n)
    if (!Number.isInteger(n) || n < 0 || n >= chunkCount(upload.size)) throw new ApiError(400, 'invalid_payload', 'chunk')
    const expected = n === chunkCount(upload.size) - 1 ? upload.size - n * CHUNK_SIZE : CHUNK_SIZE
    const bytes = await req.bytes(expected)
    if (bytes.length !== expected) throw new ApiError(400, 'invalid_payload', 'chunk_size')
    await ctx.store.putBytes(chunkKey(id, n), bytes)
    return { ok: true }
  })

  // ---- finish: verify, sniff, fingerprint
  router.post('/files/:id/complete', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const upload = await getValue<Upload>(ctx.store, `upload/${id}`)
    if (!upload || upload.ownerId !== req.user.id) throw new ApiError(404, 'not_found')
    const hash = createHash('sha256')
    const chunks = chunkCount(upload.size)
    for (let n = 0; n < chunks; n++) {
      const bytes = await ctx.store.getBytes(chunkKey(id, n))
      if (!bytes) throw new ApiError(400, 'invalid_payload', `missing chunk ${n}`)
      if (n === 0 && !looksLike(bytes, upload.mime)) {
        for (let k = 0; k < chunks; k++) await ctx.store.remove(chunkKey(id, k))
        await ctx.store.remove(`upload/${id}`)
        throw new ApiError(400, 'invalid_payload', 'content_mismatch')
      }
      hash.update(bytes)
    }
    const meta: FileMeta = { id, ownerId: upload.ownerId, kind: upload.kind, mime: upload.mime, size: upload.size, chunks, sha256: hash.digest('hex'), createdAt: iso(ctx.now()), shared: upload.kind !== 'vault' }
    await ctx.store.put(`files/${id}`, meta, { ifNew: true })
    await ctx.store.remove(`upload/${id}`)
    return meta
  })

  // ---- download (Range-aware; each response is a slice of at most one chunk)
  router.get('/files/:id', async (req, ctx) => {
    const meta = await getFile(ctx, uuidParam(req.params.id))
    if (!meta || !canRead(meta, req.user.id)) throw new ApiError(404, 'not_found') // do not reveal that a private file exists
    const range = parseRange(req.headers.get('range'), meta.size)
    if (range === 'invalid') return new Response(null, { status: 416, headers: { 'content-range': `bytes */${meta.size}` } })
    if (range === null && meta.size > CHUNK_SIZE) throw new ApiError(400, 'range_required')
    const start = range?.start ?? 0
    const end = Math.min(range?.end ?? meta.size - 1, start + CHUNK_SIZE - 1)
    const body = await readSlice(ctx, meta, start, end)
    const headers: Record<string, string> = {
      // Never served as a navigable page from the app's origin: archives are opaque bytes with a sandbox policy.
      'content-type': meta.kind === 'capsule' ? 'application/octet-stream' : meta.mime,
      'content-length': String(body.length),
      'accept-ranges': 'bytes',
      'cache-control': 'private, max-age=3600',
      'content-security-policy': "default-src 'none'; sandbox",
      'x-content-type-options': 'nosniff',
      'cross-origin-resource-policy': 'same-origin',
      'content-disposition': meta.kind === 'capsule' ? 'attachment' : 'inline',
    }
    if (range !== null) {
      headers['content-range'] = `bytes ${start}-${end}/${meta.size}`
      return new Response(body, { status: 206, headers })
    }
    return new Response(body, { status: 200, headers })
  })

  router.get('/files/:id/meta', async (req, ctx) => {
    const meta = await getFile(ctx, uuidParam(req.params.id))
    if (!meta || !canRead(meta, req.user.id)) throw new ApiError(404, 'not_found')
    return meta
  })

  router.delete('/files/:id', async (req, ctx) => {
    const meta = await getFile(ctx, uuidParam(req.params.id))
    if (!meta || meta.ownerId !== req.user.id) throw new ApiError(404, 'not_found')
    if (meta.kind === 'capsule') throw new ApiError(403, 'permission')
    await deleteFile(ctx, meta.id)
    return { ok: true }
  })
}
