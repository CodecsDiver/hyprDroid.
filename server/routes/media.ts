import type { CapsuleItem, FileMeta, ListeningSessionRecord, Memory, Playlist, Track } from '../../src/shared/types'
import { MEMORY_KINDS, type MemoryKind } from '../../src/shared/memory'
import { ApiError } from '../http'
import { bump, clean, getValue, iso, listValues, partnerOf, requireObject, update, uuidParam } from '../lib'
import type { Ctx, Req, Router } from '../router'
import { emitEvent } from './events'
import { deleteFile } from './files'

const newestFirst = <T extends { createdAt: string }>(list: T[]): T[] => list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

async function ownFile(ctx: Ctx, id: unknown, userId: string, kinds: FileMeta['kind'][], field: string): Promise<FileMeta> {
  const meta = await getValue<FileMeta>(ctx.store, `files/${uuidParam(id, field)}`)
  if (!meta || meta.ownerId !== userId || !kinds.includes(meta.kind)) throw new ApiError(400, 'invalid_payload', field)
  return meta
}

export function registerMedia(router: Router): void {
  // ================================================================ tracks
  router.get('/tracks', async (_req, ctx) => {
    const loves = new Map<string, string[]>()
    for (const key of await ctx.store.list('trackloves/')) {
      const [, trackId, userId] = key.split('/')
      if (trackId && userId) loves.set(trackId, [...(loves.get(trackId) ?? []), userId])
    }
    return (await listValues<Track & { createdAt: string }>(ctx.store, 'tracks/')).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((track) => ({ ...track, lovedBy: loves.get(track.id) ?? [] }))
  })

  router.post('/tracks', async (req, ctx) => {
    const body = requireObject(await req.json())
    const audio = await ownFile(ctx, body.audioFileId, req.user.id, ['music'], 'audioFileId')
    const cover = body.coverFileId ? await ownFile(ctx, body.coverFileId, req.user.id, ['cover'], 'coverFileId') : null
    const duration = body.durationMs === null || body.durationMs === undefined ? null : Number(body.durationMs)
    if (duration !== null && (!Number.isInteger(duration) || duration < 0 || duration > 86_400_000)) throw new ApiError(400, 'invalid_payload', 'durationMs')
    const track = {
      id: ctx.uuid(), ownerId: req.user.id, title: clean(body.title, 'title', { max: 120, required: true }), artist: clean(body.artist, 'artist', { max: 120 }),
      audioFileId: audio.id, coverFileId: cover?.id ?? null, durationMs: duration, createdAt: iso(ctx.now()),
    }
    await ctx.store.put(`tracks/${track.id}`, track)
    await bump(ctx, 'tracks')
    return track
  })

  router.delete('/tracks/:id', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const track = await getValue<Track>(ctx.store, `tracks/${id}`)
    if (!track || track.ownerId !== req.user.id) throw new ApiError(404, 'not_found')
    await ctx.store.remove(`tracks/${id}`)
    for (const key of await ctx.store.list(`trackloves/${id}/`)) await ctx.store.remove(key)
    for (const playlist of await listValues<Playlist>(ctx.store, 'playlists/')) {
      if (playlist.trackIds.includes(id)) await ctx.store.put(`playlists/${playlist.id}`, { ...playlist, trackIds: playlist.trackIds.filter((t) => t !== id) })
    }
    await update<ListeningSessionRecord>(ctx.store, 'listen/session', (s) => (s && s.trackId === id ? { ...s, trackId: null, state: 'stopped', positionMs: 0, updatedAtMs: ctx.now(), revision: s.revision + 1 } : undefined))
    await deleteFile(ctx, track.audioFileId)
    if (track.coverFileId) await deleteFile(ctx, track.coverFileId)
    await bump(ctx, 'tracks', 'playlists', 'listening_sessions')
    return { ok: true }
  })

  // ================================================================ playlists
  router.get('/playlists', async (_req, ctx) => (await listValues<Playlist & { createdAt: string }>(ctx.store, 'playlists/')).sort((a, b) => a.createdAt.localeCompare(b.createdAt)))

  router.post('/playlists', async (req, ctx) => {
    const body = requireObject(await req.json())
    const cover = body.coverFileId ? await ownFile(ctx, body.coverFileId, req.user.id, ['cover'], 'coverFileId') : null
    const playlist = { id: ctx.uuid(), ownerId: req.user.id, name: clean(body.name, 'name', { max: 60, required: true }), coverFileId: cover?.id ?? null, trackIds: [] as string[], createdAt: iso(ctx.now()) }
    await ctx.store.put(`playlists/${playlist.id}`, playlist)
    await bump(ctx, 'playlists')
    return playlist
  })

  router.put('/playlists/:id/tracks', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const playlist = await getValue<Playlist>(ctx.store, `playlists/${id}`)
    if (!playlist || playlist.ownerId !== req.user.id) throw new ApiError(404, 'not_found')
    const ids = requireObject(await req.json()).trackIds
    if (!Array.isArray(ids) || ids.length > 500) throw new ApiError(400, 'invalid_payload', 'trackIds')
    const trackIds = [...new Set(ids.map((t) => uuidParam(t, 'trackIds')))]
    for (const trackId of trackIds) if (!(await getValue(ctx.store, `tracks/${trackId}`))) throw new ApiError(400, 'invalid_payload', 'trackIds')
    await ctx.store.put(`playlists/${id}`, { ...playlist, trackIds })
    await bump(ctx, 'playlists')
    return { ok: true }
  })

  router.delete('/playlists/:id', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const playlist = await getValue<Playlist>(ctx.store, `playlists/${id}`)
    if (!playlist || playlist.ownerId !== req.user.id) throw new ApiError(404, 'not_found')
    await ctx.store.remove(`playlists/${id}`)
    if (playlist.coverFileId) await deleteFile(ctx, playlist.coverFileId)
    await bump(ctx, 'playlists')
    return { ok: true }
  })

  // ================================================================ listening together
  const consentOf = async (ctx: Ctx, userId: string): Promise<boolean> => (await getValue<{ optedIn: boolean }>(ctx.store, `listen/consent/${userId}`))?.optedIn === true

  router.get('/listening', async (req, ctx) => {
    const partner = partnerOf(ctx, req.user)
    return { consent: { me: await consentOf(ctx, req.user.id), partner: await consentOf(ctx, partner.id) }, session: await getValue<ListeningSessionRecord>(ctx.store, 'listen/session') }
  })

  router.put('/listening/consent', async (req, ctx) => {
    const optedIn = requireObject(await req.json()).optedIn
    if (typeof optedIn !== 'boolean') throw new ApiError(400, 'invalid_payload', 'optedIn')
    await ctx.store.put(`listen/consent/${req.user.id}`, { optedIn, updatedAt: iso(ctx.now()) })
    // Either person opting out ends the shared session immediately.
    if (!optedIn) await update<ListeningSessionRecord>(ctx.store, 'listen/session', (s) => (s ? { ...s, state: 'stopped', updatedAtMs: ctx.now(), revision: s.revision + 1 } : undefined))
    await bump(ctx, 'listening_consent', 'listening_sessions')
    return { optedIn }
  })

  router.post('/listening/command', async (req: Req, ctx) => {
    const body = requireObject(await req.json())
    const partner = partnerOf(ctx, req.user)
    const action = body.action
    if (action !== 'play' && action !== 'pause' && action !== 'seek' && action !== 'stop') throw new ApiError(400, 'invalid_payload', 'action')
    if (!(await consentOf(ctx, req.user.id)) || !(await consentOf(ctx, partner.id))) throw new ApiError(403, 'consent_required')
    const trackId = body.trackId ? uuidParam(body.trackId, 'trackId') : null
    const playlistId = body.playlistId ? uuidParam(body.playlistId, 'playlistId') : null
    if (trackId && !(await getValue(ctx.store, `tracks/${trackId}`))) throw new ApiError(404, 'not_found')
    if (playlistId && !(await getValue(ctx.store, `playlists/${playlistId}`))) throw new ApiError(404, 'not_found')
    const position = Math.max(0, Math.floor(Number(body.positionMs) || 0))

    let previousTrack: string | null = null
    const session = await update<ListeningSessionRecord>(ctx.store, 'listen/session', (current) => {
      previousTrack = current?.trackId ?? null
      const state = action === 'play' ? 'playing' : action === 'pause' ? 'paused' : action === 'stop' ? 'stopped' : (current?.state ?? 'stopped')
      return {
        hostId: req.user.id, trackId: trackId ?? current?.trackId ?? null, playlistId: trackId ? playlistId : (current?.playlistId ?? null),
        state, positionMs: action === 'stop' ? 0 : position, updatedAtMs: ctx.now(), revision: (current?.revision ?? 0) + 1,
      }
    })
    if (action === 'play' && trackId && trackId !== previousTrack) {
      const track = await getValue<Track>(ctx.store, `tracks/${trackId}`)
      await emitEvent(ctx, { sender: req.user, recipient: partner, clientEventId: ctx.uuid(), kind: 'listening_invite', payload: track ? { track_title: track.title } : {} })
    }
    await bump(ctx, 'listening_sessions')
    return session
  })

  // ================================================================ memory vault
  const memoryFileOk = (kind: MemoryKind, meta: FileMeta): boolean => (kind === 'photo' ? meta.mime.startsWith('image/') : meta.mime.startsWith('audio/'))

  router.get('/memories', async (req, ctx) => {
    const memories = await listValues<Memory & { createdAt: string }>(ctx.store, 'memories/')
    return newestFirst(memories.filter((m) => m.visibility === 'shared' || m.authorId === req.user.id)).slice(0, 200)
  })

  router.post('/memories', async (req, ctx) => {
    const body = requireObject(await req.json())
    const kind = body.kind as MemoryKind
    if (!MEMORY_KINDS.includes(kind)) throw new ApiError(400, 'invalid_payload', 'kind')
    const visibility = body.visibility === 'private' ? 'private' : 'shared'
    let file: FileMeta | null = null
    if (kind === 'photo' || kind === 'voice') {
      file = await ownFile(ctx, body.fileId, req.user.id, ['vault'], 'fileId')
      if (!memoryFileOk(kind, file)) throw new ApiError(400, 'invalid_payload', 'fileId')
    } else if (body.fileId) throw new ApiError(400, 'invalid_payload', 'fileId')
    const text = clean(body.body, 'body', { max: 5000, required: kind === 'note' || kind === 'milestone' })
    const date = body.occurredOn ? String(body.occurredOn) : null
    if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, 'invalid_payload', 'occurredOn')
    const memory = { id: ctx.uuid(), authorId: req.user.id, kind, title: clean(body.title, 'title', { max: 120, required: true }), body: text, fileId: file?.id ?? null, mimeType: file?.mime ?? null, occurredOn: date, visibility, createdAt: iso(ctx.now()) } satisfies Memory & { createdAt: string }
    await ctx.store.put(`memories/${memory.id}`, memory)
    if (file) await ctx.store.put(`files/${file.id}`, { ...file, shared: visibility === 'shared' })
    await bump(ctx, 'memories')
    return memory
  })

  router.patch('/memories/:id', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const body = requireObject(await req.json())
    const existing = await getValue<Memory>(ctx.store, `memories/${id}`)
    if (!existing || existing.authorId !== req.user.id) throw new ApiError(404, 'not_found')
    const next: Memory = { ...existing }
    if ('visibility' in body) {
      if (body.visibility !== 'shared' && body.visibility !== 'private') throw new ApiError(400, 'invalid_payload', 'visibility')
      next.visibility = body.visibility
    }
    if ('title' in body) next.title = clean(body.title, 'title', { max: 120, required: true })
    if ('body' in body) next.body = clean(body.body, 'body', { max: 5000 })
    await ctx.store.put(`memories/${id}`, next)
    if (next.fileId) {
      const meta = await getValue<FileMeta>(ctx.store, `files/${next.fileId}`)
      if (meta) await ctx.store.put(`files/${meta.id}`, { ...meta, shared: next.visibility === 'shared' })
    }
    await bump(ctx, 'memories')
    return next
  })

  router.delete('/memories/:id', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const memory = await getValue<Memory>(ctx.store, `memories/${id}`)
    if (!memory || memory.authorId !== req.user.id) throw new ApiError(404, 'not_found')
    await ctx.store.remove(`memories/${id}`)
    if (memory.fileId) await deleteFile(ctx, memory.fileId)
    await bump(ctx, 'memories')
    return { ok: true }
  })

  // ================================================================ time capsule (written only with the admin token; immutable)
  router.get('/capsule', async (_req, ctx) => (await listValues<CapsuleItem>(ctx.store, 'capsule/')).sort((a, b) => a.archivedAt.localeCompare(b.archivedAt) || a.slug.localeCompare(b.slug)))

  router.post('/capsule', async (req, ctx) => {
    const body = requireObject(await req.json())
    const slug = typeof body.slug === 'string' ? body.slug : ''
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) throw new ApiError(400, 'invalid_payload', 'slug')
    const file = await getValue<FileMeta>(ctx.store, `files/${uuidParam(body.fileId, 'fileId')}`)
    if (!file || file.kind !== 'capsule') throw new ApiError(400, 'invalid_payload', 'fileId')
    const item: CapsuleItem = {
      id: ctx.uuid(), slug, title: clean(body.title, 'title', { max: 120, required: true }), description: clean(body.description, 'description', { max: 500 }),
      fileId: file.id, sha256: file.sha256, byteSize: file.size, archivedAt: iso(ctx.now()),
    }
    if (!(await ctx.store.put(`capsule/${slug}`, item, { ifNew: true }))) {
      const existing = await getValue<CapsuleItem>(ctx.store, `capsule/${slug}`)
      if (existing?.sha256 === file.sha256) return existing // re-running the setup script is harmless
      throw new ApiError(409, 'immutable') // an archived item can never be replaced
    }
    return item
  }, 'admin')
}
