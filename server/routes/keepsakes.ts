import { dayNumber, questionForDay } from '../../src/domain/dailyQuestions'
import { DATE_KINDS, type DailyHistoryEntry, type DailyQuestion, type DateKind, type ImportantDate } from '../../src/shared/types'
import { ApiError } from '../http'
import { bump, clean, getValue, iso, isoDay, listValues, partnerOf, realDay, requireObject, uuidParam } from '../lib'
import type { Router } from '../router'

const MAX_DATES = 100

interface DailyAnswer {
  text: string
  at: string
}

export function registerKeepsakes(router: Router): void {
  // ================================================================ important dates (shared by both)
  router.get('/dates', async (_req, ctx) => (await listValues<ImportantDate>(ctx.store, 'dates/')).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)))

  router.post('/dates', async (req, ctx) => {
    const body = requireObject(await req.json())
    const kind = (body.kind ?? 'anniversary') as DateKind
    if (!DATE_KINDS.includes(kind)) throw new ApiError(400, 'invalid_payload', 'kind')
    if (body.yearly !== undefined && typeof body.yearly !== 'boolean') throw new ApiError(400, 'invalid_payload', 'yearly')
    if ((await ctx.store.list('dates/')).length >= MAX_DATES) throw new ApiError(409, 'limit_reached')
    const date: ImportantDate = {
      id: ctx.uuid(), authorId: req.user.id, title: clean(body.title, 'title', { max: 60, required: true }), date: realDay(body.date, 'date'),
      kind, yearly: body.yearly ?? (kind === 'anniversary' || kind === 'birthday'), createdAt: iso(ctx.now()),
    }
    await ctx.store.put(`dates/${date.id}`, date)
    await bump(ctx, 'important_dates')
    return date
  })

  router.delete('/dates/:id', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const date = await getValue<ImportantDate>(ctx.store, `dates/${id}`)
    if (!date || date.authorId !== req.user.id) throw new ApiError(404, 'not_found')
    await ctx.store.remove(`dates/${id}`)
    await bump(ctx, 'important_dates')
    return { ok: true }
  })

  // ================================================================ daily question
  /** The client says which calendar day it is for them (their local date); it must be within a day of the clock. */
  const dayFrom = (value: unknown, now: number): string => {
    const day = realDay(value, 'day')
    if (Math.abs(dayNumber(day) - dayNumber(isoDay(now))) > 1) throw new ApiError(400, 'invalid_payload', 'day')
    return day
  }
  const answerKey = (day: string, userId: string): string => `daily/${day}/${userId}`

  router.get('/daily', async (req, ctx) => {
    const day = dayFrom(req.url.searchParams.get('day'), ctx.now())
    const partner = partnerOf(ctx, req.user)
    const mine = await getValue<DailyAnswer>(ctx.store, answerKey(day, req.user.id))
    const theirs = await getValue<DailyAnswer>(ctx.store, answerKey(day, partner.id))
    const result: DailyQuestion = {
      day, question: questionForDay(day), mine: mine?.text ?? null, partnerAnswered: theirs !== null,
      // Nobody reads the other's answer before giving their own.
      partner: mine && theirs ? theirs.text : null,
    }
    return result
  })

  router.put('/daily', async (req, ctx) => {
    const body = requireObject(await req.json())
    const day = dayFrom(body.day, ctx.now())
    const text = clean(body.answer, 'answer', { max: 500, required: true })
    const partner = partnerOf(ctx, req.user)
    const mine = await getValue<DailyAnswer>(ctx.store, answerKey(day, req.user.id))
    // An answer can be reworded until the other person has answered; after that both are fixed.
    if (mine && (await getValue<DailyAnswer>(ctx.store, answerKey(day, partner.id)))) throw new ApiError(409, 'immutable')
    await ctx.store.put(answerKey(day, req.user.id), { text, at: iso(ctx.now()) } satisfies DailyAnswer)
    await bump(ctx, 'daily_answers')
    return { ok: true }
  })

  router.get('/daily/history', async (_req, ctx) => {
    const days = new Map<string, Record<string, string>>()
    for (const key of await ctx.store.list('daily/')) {
      const [, day, userId] = key.split('/')
      const answer = await getValue<DailyAnswer>(ctx.store, key)
      if (!day || !userId || !answer) continue
      days.set(day, { ...(days.get(day) ?? {}), [userId]: answer.text })
    }
    const out: DailyHistoryEntry[] = []
    for (const [day, answers] of days) if (Object.keys(answers).length === ctx.config.users.length) out.push({ day, question: questionForDay(day), answers })
    return out.sort((a, b) => b.day.localeCompare(a.day)).slice(0, 60)
  })

  // ================================================================ "our song": a heart from each person
  router.put('/tracks/:id/love', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    if (!(await getValue(ctx.store, `tracks/${id}`))) throw new ApiError(404, 'not_found')
    const body = requireObject(await req.json())
    if (typeof body.loved !== 'boolean') throw new ApiError(400, 'invalid_payload', 'loved')
    const key = `trackloves/${id}/${req.user.id}`
    if (body.loved) await ctx.store.put(key, { at: iso(ctx.now()) })
    else await ctx.store.remove(key)
    await bump(ctx, 'tracks')
    return { ok: true }
  })
}
