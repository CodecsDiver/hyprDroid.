import { AppError } from './errors'
import { db } from './supabase'

export type Bucket = 'music' | 'covers' | 'vault' | 'stickers' | 'time-capsule'

interface BucketRules {
  maxBytes: number
  mimes: readonly string[]
}

/** Mirrors the limits configured on the buckets in the migrations (the server enforces them too). */
export const BUCKET_RULES: Readonly<Record<Exclude<Bucket, 'time-capsule'>, BucketRules>> = {
  music: { maxBytes: 50 * 1024 * 1024, mimes: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/flac'] },
  covers: { maxBytes: 5 * 1024 * 1024, mimes: ['image/jpeg', 'image/png', 'image/webp'] },
  vault: { maxBytes: 25 * 1024 * 1024, mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav'] },
  stickers: { maxBytes: 5 * 1024 * 1024, mimes: ['image/jpeg', 'image/png', 'image/webp'] },
}

const EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/webm': 'webm', 'audio/flac': 'flac',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
}

export function validateUpload(bucket: Exclude<Bucket, 'time-capsule'>, file: Blob): { mime: string; ext: string } {
  const rules = BUCKET_RULES[bucket]
  const mime = file.type.split(';')[0]!.trim().toLowerCase()
  if (!rules.mimes.includes(mime)) throw new AppError('validation', `That file type (${mime || 'unknown'}) is not allowed here.`)
  if (file.size <= 0) throw new AppError('validation', 'That file is empty.')
  if (file.size > rules.maxBytes) throw new AppError('validation', `That file is larger than ${Math.round(rules.maxBytes / 1024 / 1024)} MB.`)
  return { mime, ext: EXTENSIONS[mime] ?? 'bin' }
}

/** Uploads into `<household>/<me>/<uuid>.<ext>` in a private bucket and returns the path. */
export async function uploadPrivate(bucket: Exclude<Bucket, 'time-capsule'>, householdId: string, userId: string, file: Blob): Promise<string> {
  const { mime, ext } = validateUpload(bucket, file)
  const path = `${householdId}/${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await db().storage.from(bucket).upload(path, file, { contentType: mime, upsert: false, cacheControl: '3600' })
  if (error) throw new AppError('permission', error.message, { cause: error })
  return path
}

export async function removeObject(bucket: Exclude<Bucket, 'time-capsule'>, path: string): Promise<void> {
  const { error } = await db().storage.from(bucket).remove([path])
  if (error) throw new AppError('permission', error.message, { cause: error })
}

const SIGNED_TTL_S = 3600
const REFRESH_MARGIN_MS = 5 * 60 * 1000
const cache = new Map<string, { url: string; expiresAt: number }>()
const inflight = new Map<string, Promise<string>>()

/** Short-lived signed URL for a private object, cached until shortly before it expires. */
export async function signedUrl(bucket: Bucket, path: string): Promise<string> {
  const key = `${bucket}/${path}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt - REFRESH_MARGIN_MS > Date.now()) return hit.url
  const pending =
    inflight.get(key) ??
    (async () => {
      const { data, error } = await db().storage.from(bucket).createSignedUrl(path, SIGNED_TTL_S)
      if (error || !data) throw new AppError('not_found', error?.message ?? 'No signed URL', { cause: error })
      cache.set(key, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_TTL_S * 1000 })
      return data.signedUrl
    })().finally(() => inflight.delete(key))
  inflight.set(key, pending)
  return pending
}

export async function downloadPrivate(bucket: Bucket, path: string): Promise<Blob> {
  const { data, error } = await db().storage.from(bucket).download(path)
  if (error || !data) throw new AppError('not_found', error?.message ?? 'Download failed', { cause: error })
  return data
}

export function clearSignedUrlCache(): void {
  cache.clear()
}
