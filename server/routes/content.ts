import { DATE_CATEGORIES, type DateIdea } from '../../src/domain/dateJar'
import { REACTION_ANIMATIONS } from '../../src/domain/events'
import type { HiddenNote } from '../../src/domain/notes'
import { NOTE_REVEALS } from '../../src/domain/notes'
import { validateRecipe } from '../../src/domain/spells'
import { OBJECT_ID_PATTERN } from '../../src/domain/validate'
import type { LoveNote, ReactionPreset, SpellRecipe, Sticker, FileMeta } from '../../src/shared/types'
import { ApiError } from '../http'
import { bump, clean, getValue, iso, isoDay, listValues, partnerOf, realDay, requireObject, update, uuidParam, validated } from '../lib'
import type { Ctx, Router } from '../router'
import { emitEvent } from './events'
import { deleteFile } from './files'

const CATEGORY_IDS = DATE_CATEGORIES.map((c) => c.id)
const newestFirst = <T extends { createdAt: string }>(list: T[]): T[] => list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

export function registerContent(router: Router): void {
  // ================================================================ date jar (shared by both)
  const ideaKey = (id: string) => `ideas/${id}`
  const category = (value: unknown): DateIdea['category'] => {
    if (value === undefined || value === null) return 'anything'
    if (typeof value !== 'string' || !CATEGORY_IDS.includes(value as never)) throw new ApiError(400, 'invalid_payload', 'category')
    return value as DateIdea['category']
  }
  const newIdea = (ctx: Ctx, userId: string, input: Record<string, unknown>): DateIdea => ({
    id: ctx.uuid(), title: clean(input.title, 'title', { max: 120, required: true }), notes: clean(input.notes, 'notes', { max: 500 }) || null,
    category: category(input.category), isFavorite: false, completedAt: null, completedNote: null, rating: null, createdBy: userId, createdAt: iso(ctx.now()),
  })

  router.get('/ideas', async (_req, ctx) => newestFirst(await listValues<DateIdea>(ctx.store, 'ideas/')))
  router.post('/ideas', async (req, ctx) => {
    const idea = newIdea(ctx, req.user.id, requireObject(await req.json()))
    await ctx.store.put(ideaKey(idea.id), idea)
    await bump(ctx, 'date_ideas')
    return idea
  })
  router.post('/ideas/bulk', async (req, ctx) => {
    const list = requireObject(await req.json()).ideas
    if (!Array.isArray(list) || list.length > 30) throw new ApiError(400, 'invalid_payload', 'ideas')
    const ideas = list.map((item) => newIdea(ctx, req.user.id, requireObject(item)))
    for (const idea of ideas) await ctx.store.put(ideaKey(idea.id), idea)
    await bump(ctx, 'date_ideas')
    return ideas
  })
  router.patch('/ideas/:id', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const body = requireObject(await req.json())
    const result = await update<DateIdea>(ctx.store, ideaKey(id), (idea) => {
      if (!idea) throw new ApiError(404, 'not_found')
      const next = { ...idea }
      if ('title' in body) next.title = clean(body.title, 'title', { max: 120, required: true })
      if ('notes' in body) next.notes = clean(body.notes, 'notes', { max: 500 }) || null
      if ('category' in body) next.category = category(body.category)
      if ('isFavorite' in body) {
        if (typeof body.isFavorite !== 'boolean') throw new ApiError(400, 'invalid_payload', 'isFavorite')
        next.isFavorite = body.isFavorite
      }
      if ('completedAt' in body && body.completedAt && !idea.completedAt) next.completedAt = iso(ctx.now()) // the client's clock is never trusted
      if ('completedNote' in body) next.completedNote = clean(body.completedNote, 'completedNote', { max: 500 }) || null
      if ('rating' in body) {
        const rating = body.rating
        if (rating !== null && (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5)) throw new ApiError(400, 'invalid_payload', 'rating')
        next.rating = rating as number | null
      }
      return next
    })
    await bump(ctx, 'date_ideas')
    return result
  })
  router.delete('/ideas/:id', async (req, ctx) => {
    await ctx.store.remove(ideaKey(uuidParam(req.params.id)))
    await bump(ctx, 'date_ideas')
    return { ok: true }
  })

  // ================================================================ hidden notes
  const NOTE_REVEAL_IDS = NOTE_REVEALS.map((r) => r.id)

  router.get('/notes', async (req, ctx) => {
    const notes = await listValues<HiddenNote & { createdAt: string }>(ctx.store, 'notes/')
    const today = isoDay(ctx.now())
    return newestFirst(notes.filter((n) => n.authorId === req.user.id || n.recipientId === req.user.id))
      .slice(0, 200)
      .map((n) => {
        const unlockOn = n.unlockOn ?? null
        const sealed = unlockOn !== null && today < unlockOn
        // The recipient never receives the text of a sealed note, not even hidden in the response.
        return n.recipientId === req.user.id && sealed ? { ...n, unlockOn, sealed, body: '' } : { ...n, unlockOn, sealed }
      })
  })

  router.post('/notes', async (req, ctx) => {
    const body = requireObject(await req.json())
    const partner = partnerOf(ctx, req.user)
    const clientNoteId = uuidParam(body.clientNoteId, 'clientNoteId')
    const objectId = typeof body.objectId === 'string' ? body.objectId : ''
    if (!OBJECT_ID_PATTERN.test(objectId)) throw new ApiError(400, 'invalid_payload', 'objectId')
    const reveal = (body.reveal ?? 'fade') as string
    if (!NOTE_REVEAL_IDS.includes(reveal as never)) throw new ApiError(400, 'invalid_payload', 'reveal')
    const text = clean(body.body, 'body', { max: 2000, required: true })
    const openWhen = clean(body.openWhen, 'openWhen', { max: 60 })
    let unlockOn: string | null = null
    if (body.unlockOn !== undefined && body.unlockOn !== null && body.unlockOn !== '') {
      unlockOn = realDay(body.unlockOn, 'unlockOn')
      if (unlockOn < isoDay(ctx.now() - 86_400_000) || unlockOn > isoDay(ctx.now() + 366 * 86_400_000)) throw new ApiError(400, 'invalid_payload', 'unlockOn')
    }

    const idemKey = `noteidem/${req.user.id}/${clientNoteId}`
    const existing = await getValue<{ id: string }>(ctx.store, idemKey)
    if (existing) {
      const note = await getValue<HiddenNote>(ctx.store, `notes/${existing.id}`)
      if (note) return note
    }
    const note: HiddenNote = {
      id: existing?.id ?? ctx.uuid(), authorId: req.user.id, recipientId: partner.id, objectId, body: text, openWhen: openWhen || null,
      reveal: reveal as HiddenNote['reveal'], createdAt: iso(ctx.now()), readAt: null, unlockOn,
    }
    await ctx.store.put(idemKey, { id: note.id }, { ifNew: true })
    await ctx.store.put(`notes/${note.id}`, note, { ifNew: true })
    // The body is never copied into the event: it only says "something is waiting".
    await emitEvent(ctx, { sender: req.user, recipient: partner, clientEventId: clientNoteId, kind: 'note_placed', payload: { object_id: objectId, note_id: note.id, ...(openWhen ? { open_when: openWhen } : {}) } })
    await bump(ctx, 'hidden_notes')
    return note
  })

  router.post('/notes/:id/read', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const note = await getValue<HiddenNote>(ctx.store, `notes/${id}`)
    if (!note || note.recipientId !== req.user.id) throw new ApiError(404, 'not_found')
    if (note.unlockOn && isoDay(ctx.now()) < note.unlockOn) throw new ApiError(409, 'sealed')
    const updated = await update<HiddenNote>(ctx.store, `notes/${id}`, (n) => (n ? { ...n, readAt: n.readAt ?? iso(ctx.now()) } : undefined))
    await bump(ctx, 'hidden_notes')
    return updated
  })

  router.delete('/notes/:id', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const note = await getValue<HiddenNote>(ctx.store, `notes/${id}`)
    if (!note || note.authorId !== req.user.id) throw new ApiError(404, 'not_found')
    await ctx.store.remove(`notes/${id}`)
    await bump(ctx, 'hidden_notes')
    return { ok: true }
  })

  // ================================================================ spell recipes
  router.get('/recipes', async (_req, ctx) => newestFirst(await listValues<SpellRecipe>(ctx.store, 'recipes/')))
  router.post('/recipes', async (req, ctx) => {
    const body = requireObject(await req.json())
    const input = validated(() => validateRecipe(body as never))
    const recipe: SpellRecipe = { id: ctx.uuid(), authorId: req.user.id, ...input, createdAt: iso(ctx.now()) }
    await ctx.store.put(`recipes/${recipe.id}`, recipe)
    await bump(ctx, 'spell_recipes')
    return recipe
  })
  router.delete('/recipes/:id', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const recipe = await getValue<SpellRecipe>(ctx.store, `recipes/${id}`)
    if (!recipe || recipe.authorId !== req.user.id) throw new ApiError(404, 'not_found')
    await ctx.store.remove(`recipes/${id}`)
    await bump(ctx, 'spell_recipes')
    return { ok: true }
  })

  // ================================================================ custom reactions (private to their owner)
  router.get('/presets', async (req, ctx) => (await listValues<ReactionPreset & { createdAt: string }>(ctx.store, `presets/${req.user.id}/`)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
  router.post('/presets', async (req, ctx) => {
    const body = requireObject(await req.json())
    if ((await ctx.store.list(`presets/${req.user.id}/`)).length >= 24) throw new ApiError(409, 'limit_reached')
    const animation = String(body.animation ?? 'float')
    if (!REACTION_ANIMATIONS.includes(animation as never)) throw new ApiError(400, 'invalid_payload', 'animation')
    const preset = { id: ctx.uuid(), ownerId: req.user.id, label: clean(body.label, 'label', { max: 24, required: true }), emoji: clean(body.emoji, 'emoji', { max: 16, required: true }), animation: animation as ReactionPreset['animation'], createdAt: iso(ctx.now()) }
    await ctx.store.put(`presets/${req.user.id}/${preset.id}`, preset)
    return preset
  })
  router.delete('/presets/:id', async (req, ctx) => {
    await ctx.store.remove(`presets/${req.user.id}/${uuidParam(req.params.id)}`)
    return { ok: true }
  })

  // ================================================================ love universe notes + stickers
  router.get('/love-notes', async (_req, ctx) => (await listValues<LoveNote & { createdAt: string }>(ctx.store, 'lovenotes/')).sort((a, b) => a.createdAt.localeCompare(b.createdAt)))

  const makeLoveNote = (ctx: Ctx, authorId: string, voice: unknown, body: unknown): LoveNote & { createdAt: string } => {
    if (voice !== 'love' && voice !== 'miss') throw new ApiError(400, 'invalid_payload', 'voice')
    return { id: ctx.uuid(), authorId, voice, body: clean(body, 'body', { max: 500, required: true }), createdAt: iso(ctx.now()) }
  }
  router.post('/love-notes', async (req, ctx) => {
    const body = requireObject(await req.json())
    const note = makeLoveNote(ctx, req.user.id, body.voice, body.body)
    await ctx.store.put(`lovenotes/${note.id}`, note)
    await bump(ctx, 'love_notes')
    return note
  })
  router.post('/love-notes/bulk', async (req, ctx) => {
    const list = requireObject(await req.json()).notes
    if (!Array.isArray(list) || list.length > 100) throw new ApiError(400, 'invalid_payload', 'notes')
    const have = new Set((await listValues<LoveNote>(ctx.store, 'lovenotes/')).filter((n) => n.authorId === req.user.id).map((n) => n.body))
    let added = 0
    for (const item of list) {
      const entry = requireObject(item)
      const note = makeLoveNote(ctx, req.user.id, entry.voice, entry.body)
      if (have.has(note.body)) continue
      await ctx.store.put(`lovenotes/${note.id}`, note)
      added++
    }
    await bump(ctx, 'love_notes')
    return { added }
  })
  router.delete('/love-notes/:id', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const note = await getValue<LoveNote>(ctx.store, `lovenotes/${id}`)
    if (!note || note.authorId !== req.user.id) throw new ApiError(404, 'not_found')
    await ctx.store.remove(`lovenotes/${id}`)
    await bump(ctx, 'love_notes')
    return { ok: true }
  })

  const ownStickerFile = async (ctx: Ctx, fileId: string, userId: string): Promise<FileMeta> => {
    const meta = await getValue<FileMeta>(ctx.store, `files/${fileId}`)
    if (!meta || meta.kind !== 'sticker' || meta.ownerId !== userId) throw new ApiError(400, 'invalid_payload', 'fileId')
    return meta
  }
  router.get('/stickers', async (_req, ctx) => (await listValues<Sticker & { createdAt: string }>(ctx.store, 'stickers/')).sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
  router.post('/stickers', async (req, ctx) => {
    const body = requireObject(await req.json())
    const fileId = uuidParam(body.fileId, 'fileId')
    await ownStickerFile(ctx, fileId, req.user.id)
    const sticker = { id: ctx.uuid(), ownerId: req.user.id, label: clean(body.label, 'label', { max: 40, required: true }), fileId, sprite: null, createdAt: iso(ctx.now()) }
    await ctx.store.put(`stickers/${sticker.id}`, sticker)
    await bump(ctx, 'stickers')
    return sticker
  })
  /** One sprite sheet → many stickers (idempotent per sheet file). */
  router.post('/stickers/sheet', async (req, ctx) => {
    const body = requireObject(await req.json())
    const fileId = uuidParam(body.fileId, 'fileId')
    await ownStickerFile(ctx, fileId, req.user.id)
    const cols = Number(body.cols)
    const rows = Number(body.rows)
    const labels = body.labels
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1 || cols > 16 || rows > 16 || !Array.isArray(labels) || labels.length > cols * rows) throw new ApiError(400, 'invalid_payload', 'sheet')
    const existing = (await listValues<Sticker>(ctx.store, 'stickers/')).filter((s) => s.fileId === fileId)
    if (existing.length > 0) return { added: 0 }
    for (const [index, label] of labels.entries()) {
      const sticker = { id: ctx.uuid(), ownerId: req.user.id, label: clean(label, 'label', { max: 40, required: true }), fileId, sprite: { cols, rows, index }, createdAt: iso(ctx.now() + index) }
      await ctx.store.put(`stickers/${sticker.id}`, sticker)
    }
    await bump(ctx, 'stickers')
    return { added: labels.length }
  })
  router.delete('/stickers/:id', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const sticker = await getValue<Sticker>(ctx.store, `stickers/${id}`)
    if (!sticker || sticker.ownerId !== req.user.id) throw new ApiError(404, 'not_found')
    await ctx.store.remove(`stickers/${id}`)
    const stillUsed = (await listValues<Sticker>(ctx.store, 'stickers/')).some((s) => s.fileId === sticker.fileId)
    if (!stillUsed) await deleteFile(ctx, sticker.fileId)
    await bump(ctx, 'stickers')
    return { ok: true }
  })
}
