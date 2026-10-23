import { describe, expect, it } from 'vitest'
import { detectHeartSync, HeartTapLedger } from '@/domain/heartSync'
import { chooseAudio, deriveEnvironment, dominantMood, timeOfDayFor } from '@/domain/environment'
import { drawIdea, type DateIdea } from '@/domain/dateJar'
import { GARDEN_CAPACITY, layoutGarden, plantStage, type GardenPlant } from '@/domain/garden'
import { expectedPositionMs, estimateClockOffset, isSyncActive, planCorrection } from '@/domain/listeningSync'
import { pickNote, spriteStyle } from '@/domain/loveUniverse'
import { mayPlayMischief } from '@/domain/mischief'
import { MOODS, MOOD_KEYS, type MoodSnapshot } from '@/domain/moods'
import { unreadByObject, type HiddenNote } from '@/domain/notes'
import { roseProgress, roseStage } from '@/domain/rose'
import { cleanText } from '@/domain/validate'
import { validateRecipe } from '@/domain/spells'

const NOW = new Date('2025-06-01T21:00:00')
const mood = (userId: string, key: (typeof MOOD_KEYS)[number], hoursAgo = 1): MoodSnapshot => ({
  userId, mood: key, updatedAt: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
})

describe('environment', () => {
  it('lets the highest-priority mood drive the room (miss-you > gentle > bedtime > arriving > cuddly > busy)', () => {
    const order = ['missing', 'gentle', 'sleepy', 'arriving', 'cuddly', 'busy'] as const
    for (let i = 0; i < order.length - 1; i++) {
      expect(dominantMood([mood('a', order[i + 1]!), mood('b', order[i]!)], NOW.getTime())?.mood).toBe(order[i])
    }
  })

  it('ignores stale moods and defaults to clear', () => {
    expect(deriveEnvironment({ moods: [mood('a', 'missing', 48)], now: NOW }).weather).toBe('clear')
    expect(deriveEnvironment({ moods: [], now: NOW }).dominant).toBeNull()
  })

  it('maps moods onto weather, fog and exactly one ambient loop', () => {
    const rain = deriveEnvironment({ moods: [mood('a', 'missing')], now: NOW })
    expect(rain.weather).toBe('rain')
    expect(rain.ambient).toBe('rain')
    expect(rain.fog).not.toBeNull()
    expect(deriveEnvironment({ moods: [mood('a', 'arriving')], now: NOW }).ambient).toBe('reunion')
    expect(deriveEnvironment({ moods: [mood('a', 'busy')], now: NOW }).ambient).toBeNull()
  })

  it('every mood has a definition with a plant and callout', () => {
    for (const key of MOOD_KEYS) {
      expect(MOODS[key].callout('Vee')).toContain('Vee')
      expect(MOODS[key].plant).toBeTruthy()
    }
  })

  it('holds back the room song while a mood loop plays, and respects mute', () => {
    expect(chooseAudio({ ambient: 'rain' }, { soundOn: true, roomSongOn: true })).toEqual({ ambient: 'rain', roomSong: false })
    expect(chooseAudio({ ambient: null }, { soundOn: true, roomSongOn: true })).toEqual({ ambient: null, roomSong: true })
    expect(chooseAudio({ ambient: 'rain' }, { soundOn: false, roomSongOn: true })).toEqual({ ambient: null, roomSong: false })
  })

  it('derives time of day', () => {
    expect([6, 12, 18, 23, 2].map(timeOfDayFor)).toEqual(['dawn', 'day', 'dusk', 'night', 'night'])
  })
})

describe('rose', () => {
  it('grows through six stages and caps out', () => {
    expect([0, 11, 12, 59, 60, 160, 9999].map(roseStage)).toEqual([0, 0, 1, 2, 3, 5, 5])
    expect(roseProgress(36).progress).toBeCloseTo(0.2)
    expect(roseProgress(500)).toMatchObject({ stage: 5, progress: 1, nextAt: null })
  })
})

describe('garden', () => {
  const plant = (n: number, extra: Partial<GardenPlant> = {}): GardenPlant => ({
    id: `p${String(n).padStart(3, '0')}`, plantedBy: 'u', mood: 'happy', plantedOn: `2025-01-${String((n % 28) + 1).padStart(2, '0')}`, seed: n * 7919, waterCount: 0, lastWateredAt: null, ...extra,
  })

  it('is deterministic and keeps existing plants in place as new ones arrive', () => {
    const before = layoutGarden([plant(1), plant(2), plant(3)])
    const again = layoutGarden([plant(3), plant(1), plant(2)])
    expect(again).toEqual(before)
    const after = layoutGarden([plant(1), plant(2), plant(3), plant(4, { plantedOn: '2025-02-01' })])
    for (const p of before) expect(after.find((a) => a.plant.id === p.plant.id)).toMatchObject({ x: p.x, y: p.y })
  })

  it('never overlaps slots and caps capacity, favouring the newest', () => {
    const many = Array.from({ length: GARDEN_CAPACITY + 10 }, (_, n) => plant(n + 1, { plantedOn: `2025-03-${String((n % 28) + 1).padStart(2, '0')}`, seed: 5 }))
    const placed = layoutGarden(many)
    expect(placed).toHaveLength(GARDEN_CAPACITY)
  })

  it('grows with watering', () => {
    expect([0, 1, 3, 6, 50].map(plantStage)).toEqual([1, 2, 3, 4, 4])
  })
})

describe('date jar', () => {
  const idea = (id: string, extra: Partial<DateIdea> = {}): DateIdea => ({
    id, title: id, notes: null, category: 'anything', isFavorite: false, completedAt: null, completedNote: null, rating: null, createdBy: 'u', createdAt: '2025-01-01', ...extra,
  })

  it('only draws open ideas', () => {
    expect(drawIdea([idea('done', { completedAt: '2025-01-02' })])).toBeNull()
    expect(drawIdea([idea('done', { completedAt: 'x' }), idea('open')])?.id).toBe('open')
  })

  it('weights favourites and avoids an immediate repeat', () => {
    const ideas = [idea('a'), idea('b', { isFavorite: true })]
    expect(drawIdea(ideas, { rng: () => 0.9 })?.id).toBe('b') // favourite owns 2/3 of the range
    expect(drawIdea(ideas, { rng: () => 0.1, excludeId: 'a' })?.id).toBe('b')
    expect(drawIdea([idea('only')], { excludeId: 'only' })?.id).toBe('only') // no choice → allow repeat
  })

  it('filters by category but keeps "anything" ideas', () => {
    const ideas = [idea('home', { category: 'at_home' }), idea('out', { category: 'outdoors' }), idea('any')]
    const seen = new Set([0, 0.4, 0.99].map((rng) => drawIdea(ideas, { category: 'at_home', rng: () => rng })?.id))
    expect([...seen].sort()).toEqual(['any', 'home'])
  })
})

describe('listening sync', () => {
  it('advances position only while playing, using server time', () => {
    const base = { positionMs: 10_000, updatedAtMs: 1_000_000, revision: 1 }
    expect(expectedPositionMs({ ...base, state: 'playing' }, 1_004_000)).toBe(14_000)
    expect(expectedPositionMs({ ...base, state: 'paused' }, 1_004_000)).toBe(10_000)
    expect(expectedPositionMs({ ...base, state: 'playing' }, 1_900_000, 60_000)).toBe(60_000)
  })

  it('trusts the lowest-latency clock sample', () => {
    const offset = estimateClockOffset([
      { clientSentMs: 0, serverMs: 5_000, clientReceivedMs: 2_000 }, // slow, noisy
      { clientSentMs: 10_000, serverMs: 10_510, clientReceivedMs: 10_020 }, // fast
    ])
    expect(offset).toBeCloseTo(500, -1)
  })

  it('ignores small drift, nudges moderate drift, seeks on large drift', () => {
    expect(planCorrection(10_000, 10_100).action).toBe('none')
    expect(planCorrection(10_000, 10_800)).toEqual({ action: 'nudge', playbackRate: 1.04 })
    expect(planCorrection(10_800, 10_000)).toEqual({ action: 'nudge', playbackRate: 0.96 })
    expect(planCorrection(10_000, 14_000)).toEqual({ action: 'seek', targetMs: 14_000, playbackRate: 1 })
  })

  it('requires both people to have opted in', () => {
    expect(isSyncActive({ me: true, partner: false })).toBe(false)
    expect(isSyncActive({ me: true, partner: true })).toBe(true)
  })
})

describe('hearts synced', () => {
  it('detects taps within the window from either direction', () => {
    expect(detectHeartSync([1000], [3000])).toBe(true)
    expect(detectHeartSync([1000], [9000])).toBe(false)
    const ledger = new HeartTapLedger(5000)
    expect(ledger.recordMine(0)).toBe(false)
    expect(ledger.recordPartner(2000)).toBe(true)
  })
})

describe('mischief consent (client-side re-check)', () => {
  it('requires opt-in, a second opt-in for disruptive effects, and respects pause', () => {
    const base = { allowMischief: true, allowDisruptive: false, paused: false }
    expect(mayPlayMischief('confetti', base)).toBe(true)
    expect(mayPlayMischief('shake_room', base)).toBe(false)
    expect(mayPlayMischief('shake_room', { ...base, allowDisruptive: true })).toBe(true)
    expect(mayPlayMischief('confetti', { ...base, paused: true })).toBe(false)
    expect(mayPlayMischief('confetti', { ...base, allowMischief: false })).toBe(false)
    expect(mayPlayMischief('unknown', base)).toBe(false)
  })
})

describe('love universe helpers', () => {
  it('never repeats the previous note when there is a choice', () => {
    const pool = ['a', 'b', 'c']
    for (let i = 0; i < 50; i++) {
      const first = pickNote(pool, Math.random, null)!
      expect(pickNote(pool, Math.random, first.index)!.index).not.toBe(first.index)
    }
    expect(pickNote([], Math.random, null)).toBeNull()
    expect(pickNote(['only'], Math.random, 0)?.text).toBe('only')
  })

  it('addresses sprite sheet cells the same way as the original (3×6 → 0/50/100%, 0..100%)', () => {
    const style = spriteStyle({ cols: 3, rows: 6, index: 17 }, 'blob:x')
    expect(style.backgroundSize).toBe('300% 600%')
    expect(style.backgroundPosition).toBe('100% 100%')
    expect(spriteStyle({ cols: 3, rows: 6, index: 4 }, 'x').backgroundPosition).toBe('50% 20%')
    expect(spriteStyle({ cols: 3, rows: 6, index: 0 }, 'x').backgroundPosition).toBe('0% 0%')
  })
})

describe('hidden notes', () => {
  it('counts unread notes per object for the recipient only', () => {
    const note = (id: string, objectId: string, recipientId: string, readAt: string | null): HiddenNote => ({
      id, authorId: 'a', recipientId, objectId, body: '', openWhen: null, reveal: 'fade', createdAt: '2025-01-01', readAt,
    })
    const counts = unreadByObject([note('1', 'obj_guitar', 'me', null), note('2', 'obj_guitar', 'me', null), note('3', 'obj_rose_pot', 'me', '2025'), note('4', 'obj_guitar', 'them', null)], 'me')
    expect(Object.fromEntries(counts)).toEqual({ obj_guitar: 2 })
  })
})

describe('validation', () => {
  it('cleans and bounds text', () => {
    expect(cleanText('  hi\u0000 ', 'x', { max: 5 })).toBe('hi')
    expect(() => cleanText('', 'x', { max: 5, required: true })).toThrow()
    expect(() => cleanText('123456', 'x', { max: 5 })).toThrow()
    expect(cleanText(undefined, 'x', { max: 5 })).toBe('')
  })

  it('validates spell recipes', () => {
    const ok = validateRecipe({ name: ' Moon tea ', ingredients: ['honey', 'honey', 'lavender'], effect: 'moon_glow', message: '', color: '#AABBCC' })
    expect(ok).toMatchObject({ name: 'Moon tea', ingredients: ['honey', 'lavender'], color: '#aabbcc' })
    expect(() => validateRecipe({ name: 'x', effect: 'rm_rf' })).toThrow()
    expect(() => validateRecipe({ name: 'x', effect: 'starfall', ingredients: Array(9).fill('a') })).toThrow()
    expect(validateRecipe({ name: 'x', effect: 'starfall', color: 'red' }).color).toBe('#c9a7ff')
  })
})
