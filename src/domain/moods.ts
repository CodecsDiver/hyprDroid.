/**
 * Moods. The first six keep the wording and behaviour of the original Signal
 * Home mood signals; four gentler everyday moods round out the set.
 * `priority`: when both people have moods, the LOWEST number drives the room
 * (same ordering the original used: miss-you > gentle > bedtime > arriving > cuddly > busy).
 */

export const MOOD_KEYS = ['happy', 'calm', 'playful', 'cozy', 'missing', 'gentle', 'busy', 'sleepy', 'arriving', 'cuddly'] as const
export type MoodKey = (typeof MOOD_KEYS)[number]

export type WeatherKind = 'clear' | 'rain' | 'candle' | 'starlight' | 'sunrise' | 'hearts' | 'busy' | 'sparkle' | 'cozy'
export type PlantSpecies = 'sunflower' | 'lavender' | 'daisy' | 'chamomile' | 'bluebell' | 'snowdrop' | 'clover' | 'moonflower' | 'marigold' | 'peony'

export interface MoodDefinition {
  key: MoodKey
  label: string
  emoji: string
  priority: number
  weather: WeatherKind
  plant: PlantSpecies
  /** Bloom colour used by the garden. */
  color: string
  callout: (name: string) => string
}

export const MOODS: Readonly<Record<MoodKey, MoodDefinition>> = {
  missing: {
    key: 'missing', label: 'I miss you, Honey Bee!', emoji: '🌧️', priority: 1, weather: 'rain', plant: 'bluebell', color: '#8fb4ff',
    callout: (name) => `${name} really misses you. Maybe a call, or a hug, is in order.`,
  },
  gentle: {
    key: 'gentle', label: 'Be gentle with me...', emoji: '🕯️', priority: 2, weather: 'candle', plant: 'snowdrop', color: '#f4f1ff',
    callout: (name) => `${name} needs gentleness today. Maybe be extra soft.`,
  },
  sleepy: {
    key: 'sleepy', label: "It's bedtime, baby! Call me!", emoji: '🌙', priority: 3, weather: 'starlight', plant: 'moonflower', color: '#b7a6ff',
    callout: (name) => `${name} says it's bedtime, baby. Maybe say goodnight.`,
  },
  arriving: {
    key: 'arriving', label: 'About to be in your arms!', emoji: '🌅', priority: 4, weather: 'sunrise', plant: 'marigold', color: '#ffb13d',
    callout: (name) => `${name} is about to be in your arms. The waiting is almost over.`,
  },
  cuddly: {
    key: 'cuddly', label: 'Feeling cuddly ;)', emoji: '💞', priority: 5, weather: 'hearts', plant: 'peony', color: '#ff8fbe',
    callout: (name) => `${name} is feeling cuddly. Maybe come give some cuddles.`,
  },
  busy: {
    key: 'busy', label: 'Busy, but thinking of you!', emoji: '🫶', priority: 6, weather: 'busy', plant: 'clover', color: '#7fd99b',
    callout: (name) => `${name} is busy, but still thinking of you. No pressure, just love.`,
  },
  playful: {
    key: 'playful', label: 'Feeling playful', emoji: '🎈', priority: 7, weather: 'sparkle', plant: 'daisy', color: '#fff4a8',
    callout: (name) => `${name} is feeling playful. Mischief might be welcome.`,
  },
  happy: {
    key: 'happy', label: 'Feeling happy', emoji: '☀️', priority: 8, weather: 'sparkle', plant: 'sunflower', color: '#ffd23f',
    callout: (name) => `${name} is feeling happy. Maybe share the joy.`,
  },
  cozy: {
    key: 'cozy', label: 'Cozy at home', emoji: '🛋️', priority: 9, weather: 'cozy', plant: 'chamomile', color: '#ffe2b8',
    callout: (name) => `${name} is cozy at home.`,
  },
  calm: {
    key: 'calm', label: 'Calm and quiet', emoji: '🍃', priority: 10, weather: 'clear', plant: 'lavender', color: '#b79cff',
    callout: (name) => `${name} is calm and quiet.`,
  },
}

export function isMoodKey(value: unknown): value is MoodKey {
  return typeof value === 'string' && (MOOD_KEYS as readonly string[]).includes(value)
}

export interface MoodSnapshot {
  userId: string
  mood: MoodKey
  note?: string | null
  /** ISO timestamp, server-stamped. */
  updatedAt: string
}
