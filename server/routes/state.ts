import { isMoodKey, MOODS } from '../../src/domain/moods'
import { cleanText, ValidationError } from '../../src/domain/validate'
import type { GardenPlant } from '../../src/domain/garden'
import type { MoodSnapshot } from '../../src/domain/moods'
import type { UserSettings } from '../../src/shared/types'
import { ApiError } from '../http'
import { bump, getValue, iso, isoDay, listValues, requireObject, update, uuidParam } from '../lib'
import type { Router } from '../router'
import { getSettings, unseenFor } from './events'

function hour(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 23) throw new ApiError(400, 'invalid_payload', field)
  return value
}

const BOOLEANS = [
  'notifyLovePings', 'notifyHiddenNotes', 'notifyMischief', 'notifyListeningInvites', 'allowMischief', 'allowDisruptiveMischief',
] as const

export function registerState(router: Router): void {
  // ---------------------------------------------------------------- settings (own only)
  router.get('/settings', (req, ctx) => getSettings(ctx, req.user.id))

  router.put('/settings', async (req, ctx) => {
    const body = requireObject(await req.json())
    const next = { ...(await getSettings(ctx, req.user.id)) } as UserSettings
    for (const key of BOOLEANS) {
      if (key in body) {
        if (typeof body[key] !== 'boolean') throw new ApiError(400, 'invalid_payload', key)
        next[key] = body[key]
      }
    }
    if ('quietHoursStart' in body) next.quietHoursStart = hour(body.quietHoursStart, 'quietHoursStart')
    if ('quietHoursEnd' in body) next.quietHoursEnd = hour(body.quietHoursEnd, 'quietHoursEnd')
    if (!next.allowMischief) next.allowDisruptiveMischief = false // the stronger opt-in never outlives the weaker one
    await ctx.store.put(`settings/${req.user.id}`, next)
    return next
  })

  router.get('/state/bond', async (_req, ctx) => ({ bondXp: (await getValue<{ xp: number }>(ctx.store, 'state/bond'))?.xp ?? 0 }))

  // ---------------------------------------------------------------- moods + garden
  router.get('/moods', async (_req, ctx) => {
    const out: MoodSnapshot[] = []
    for (const user of ctx.config.users) {
      const mood = await getValue<MoodSnapshot>(ctx.store, `moods/${user.id}`)
      if (mood) out.push(mood)
    }
    return out
  })

  router.post('/moods', async (req, ctx) => {
    const body = requireObject(await req.json())
    if (!isMoodKey(body.mood)) throw new ApiError(400, 'invalid_mood')
    let note: string
    try {
      note = cleanText(body.note, 'note', { max: 140 })
    } catch (error) {
      if (error instanceof ValidationError) throw new ApiError(400, 'invalid_payload', 'note')
      throw error
    }
    const snapshot: MoodSnapshot = { userId: req.user.id, mood: body.mood, note: note || null, updatedAt: iso(ctx.now()) }
    await ctx.store.put(`moods/${req.user.id}`, snapshot)

    // The first mood of each (UTC) day plants that day's seed.
    const day = isoDay(ctx.now())
    const id = ctx.uuid()
    if (await ctx.store.put(`plantday/${req.user.id}/${day}`, { plantId: id }, { ifNew: true })) {
      const plant: GardenPlant = {
        id, plantedBy: req.user.id, mood: body.mood, plantedOn: day, seed: Math.floor(Math.random() * 2_147_483_647), waterCount: 0, lastWateredAt: null,
      }
      await ctx.store.put(`plants/${day}-${id}`, plant)
      await ctx.store.put(`plantindex/${id}`, { key: `plants/${day}-${id}` })
    }
    await bump(ctx, 'moods', 'garden_plants')
    return snapshot
  })

  router.get('/plants', async (_req, ctx) => {
    const keys = (await ctx.store.list('plants/')).slice(-64)
    const plants = (await Promise.all(keys.map((key) => getValue<GardenPlant>(ctx.store, key)))).filter((p): p is GardenPlant => p !== null)
    return plants.reverse()
  })

  router.get('/plants/watered-today', async (_req, ctx) => {
    const day = isoDay(ctx.now())
    return (await ctx.store.list(`water/${day}/`)).map((key) => key.slice(`water/${day}/`.length).replace('_', ':'))
  })

  router.post('/plants/:id/water', async (req, ctx) => {
    const id = uuidParam(req.params.id)
    const index = await getValue<{ key: string }>(ctx.store, `plantindex/${id}`)
    if (!index) throw new ApiError(404, 'not_found')
    const day = isoDay(ctx.now())
    // One watering per person per plant per day; the marker doubles as the idempotency key.
    if (await ctx.store.put(`water/${day}/${id}_${req.user.id}`, { at: iso(ctx.now()) }, { ifNew: true })) {
      await update<GardenPlant>(ctx.store, index.key, (plant) => (plant ? { ...plant, waterCount: plant.waterCount + 1, lastWateredAt: iso(ctx.now()) } : undefined))
      await bump(ctx, 'garden_plants')
    }
    return getValue<GardenPlant>(ctx.store, index.key)
  })
}

export { MOODS, listValues, unseenFor }
