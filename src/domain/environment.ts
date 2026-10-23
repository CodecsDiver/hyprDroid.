import { MOODS, type MoodSnapshot, type WeatherKind } from './moods'

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night'
export type AmbientId = 'rain' | 'gentle' | 'sleep' | 'reunion' | 'cuddly'

export interface EnvironmentState {
  weather: WeatherKind
  /** The mood that is currently driving the room, if any. */
  dominant: MoodSnapshot | null
  timeOfDay: TimeOfDay
  /** Ceiling lamp. Colours are 0xRRGGBB. */
  lamp: { color: number; intensity: number; halo: number }
  /** Light coming through the window. */
  window: { color: number; intensity: number }
  fog: { color: number; near: number; far: number } | null
  ambient: AmbientId | null
  /** 0..1 multiplier for particle counts; the renderer scales further by quality. */
  particleDensity: number
}

export interface EnvironmentInput {
  moods: readonly MoodSnapshot[]
  now: Date
  /** A mood older than this stops shaping the room (it is still shown in the garden). */
  moodTtlMs?: number
  /** Lamp manually switched on by tapping it. */
  lampOn?: boolean
}

const DEFAULT_MOOD_TTL_MS = 36 * 60 * 60 * 1000

export function timeOfDayFor(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 8) return 'dawn'
  if (hour >= 8 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'dusk'
  return 'night'
}

const WEATHER_AMBIENT: Partial<Record<WeatherKind, AmbientId>> = {
  rain: 'rain', candle: 'gentle', starlight: 'sleep', sunrise: 'reunion', hearts: 'cuddly',
}

const WINDOW_BY_TIME: Record<TimeOfDay, { color: number; intensity: number }> = {
  dawn: { color: 0xffc9a0, intensity: 0.9 },
  day: { color: 0xfff1d6, intensity: 1.3 },
  dusk: { color: 0xff9f7a, intensity: 0.8 },
  night: { color: 0x7d86ff, intensity: 0.45 },
}

const LAMP_BY_WEATHER: Partial<Record<WeatherKind, { color: number; intensity: number; halo: number }>> = {
  rain: { color: 0xffcc8d, intensity: 1.36, halo: 0.16 },
  candle: { color: 0xffc27a, intensity: 1.5, halo: 0.2 },
  starlight: { color: 0xa7a4ff, intensity: 0.5, halo: 0.08 },
  sunrise: { color: 0xffd16a, intensity: 3.8, halo: 0.48 },
  hearts: { color: 0xffb4c9, intensity: 2.25, halo: 0.26 },
  busy: { color: 0xffcd7b, intensity: 1.6, halo: 0.18 },
  sparkle: { color: 0xfff0b0, intensity: 1.2, halo: 0.12 },
  cozy: { color: 0xffbf80, intensity: 1.8, halo: 0.2 },
}

/** Picks the mood that drives the room: freshest-eligible, then by priority, then most recent. */
export function dominantMood(moods: readonly MoodSnapshot[], nowMs: number, ttlMs = DEFAULT_MOOD_TTL_MS): MoodSnapshot | null {
  const eligible = moods.filter((m) => nowMs - Date.parse(m.updatedAt) <= ttlMs && MOODS[m.mood])
  if (eligible.length === 0) return null
  return [...eligible].sort(
    (a, b) => MOODS[a.mood].priority - MOODS[b.mood].priority || Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  )[0]!
}

export function deriveEnvironment(input: EnvironmentInput): EnvironmentState {
  const nowMs = input.now.getTime()
  const dominant = dominantMood(input.moods, nowMs, input.moodTtlMs)
  const weather: WeatherKind = dominant ? MOODS[dominant.mood].weather : 'clear'
  const timeOfDay = timeOfDayFor(input.now.getHours())

  const base = LAMP_BY_WEATHER[weather]
  const lamp = base ?? (input.lampOn || timeOfDay === 'night' ? { color: 0xffcc8d, intensity: 1.1, halo: 0.1 } : { color: 0xffcc8d, intensity: 0, halo: 0.018 })
  const windowLight = { ...WINDOW_BY_TIME[timeOfDay] }
  if (weather === 'rain') windowLight.intensity *= 0.6
  if (weather === 'sunrise') Object.assign(windowLight, { color: 0xffd36a, intensity: 1.8 })
  if (weather === 'starlight') Object.assign(windowLight, { color: 0x6f6cff, intensity: 0.5 })

  const fog =
    weather === 'rain' ? { color: 0x2b2546, near: 4.2, far: 8.5 }
    : weather === 'sunrise' ? { color: 0x593014, near: 5.2, far: 10.5 }
    : null

  const density = { rain: 1, starlight: 0.8, sunrise: 0.9, hearts: 0.7, candle: 0.5, sparkle: 0.6, busy: 0.4, cozy: 0.3, clear: timeOfDay === 'night' ? 0.4 : 0.15 }[weather]

  return {
    weather,
    dominant,
    timeOfDay,
    lamp,
    window: windowLight,
    fog,
    ambient: WEATHER_AMBIENT[weather] ?? null,
    particleDensity: density,
  }
}

/**
 * The original app never layered mood loops: exactly one plays, and the room
 * song is held back while any mood loop is active. This encodes that rule.
 */
export function chooseAudio(env: Pick<EnvironmentState, 'ambient'>, options: { soundOn: boolean; roomSongOn: boolean }): { ambient: AmbientId | null; roomSong: boolean } {
  if (!options.soundOn) return { ambient: null, roomSong: false }
  if (env.ambient) return { ambient: env.ambient, roomSong: false }
  return { ambient: null, roomSong: options.roomSongOn }
}
