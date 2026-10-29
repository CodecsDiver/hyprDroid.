import { computed, reactive, watch } from 'vue'
import type { Quality } from '@/scene/weather'

/**
 * Per-device convenience preferences. These live in localStorage because they
 * are about THIS device (volume, motion, graphics) — never shared state.
 * Everything shared between the two people lives in the database.
 */

export type MotionPreference = 'auto' | 'reduced' | 'full'
export type QualityPreference = 'auto' | Quality

interface Prefs {
  soundOn: boolean
  volume: number
  motion: MotionPreference
  quality: QualityPreference
  lampOn: boolean
  mischiefPaused: boolean
  /** SoundCloud album/playlist/track link to start when you come in (empty: nothing is ever contacted). */
  entranceUrl: string
  entranceOn: boolean
}

const KEY = 'signalhome.prefs.v1'
const DEFAULTS: Prefs = { soundOn: true, volume: 0.8, motion: 'auto', quality: 'auto', lampOn: false, mischiefPaused: false, entranceUrl: '', entranceOn: false }

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      soundOn: typeof parsed.soundOn === 'boolean' ? parsed.soundOn : DEFAULTS.soundOn,
      volume: typeof parsed.volume === 'number' ? Math.min(1, Math.max(0, parsed.volume)) : DEFAULTS.volume,
      motion: parsed.motion === 'reduced' || parsed.motion === 'full' ? parsed.motion : 'auto',
      quality: parsed.quality === 'low' || parsed.quality === 'medium' || parsed.quality === 'high' ? parsed.quality : 'auto',
      lampOn: parsed.lampOn === true,
      mischiefPaused: parsed.mischiefPaused === true,
      entranceUrl: typeof parsed.entranceUrl === 'string' ? parsed.entranceUrl.slice(0, 300) : '',
      entranceOn: parsed.entranceOn === true,
    }
  } catch {
    return { ...DEFAULTS } // storage unavailable (private mode, blocked): run with defaults
  }
}

export const prefs = reactive<Prefs>(load())

watch(prefs, (value) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    /* non-fatal */
  }
  applyMotionAttribute()
}, { deep: true })

const systemReducedQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null

export function isReducedMotion(): boolean {
  return prefs.motion === 'reduced' || (prefs.motion === 'auto' && !!systemReducedQuery?.matches)
}

export function applyMotionAttribute(): void {
  document.documentElement.dataset.motion = prefs.motion === 'auto' ? 'auto' : prefs.motion
}

systemReducedQuery?.addEventListener?.('change', applyMotionAttribute)

/** Picks a rendering quality from the preference or, for `auto`, from device hints. */
export function resolveQuality(): Quality {
  if (prefs.quality !== 'auto') return prefs.quality
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  if (isReducedMotion() || nav.connection?.saveData) return 'low'
  const cores = navigator.hardwareConcurrency || 4
  const memory = nav.deviceMemory ?? 4
  if (cores <= 2 || memory <= 2) return 'low'
  if (cores >= 8 && memory >= 8 && (window.devicePixelRatio || 1) >= 2) return 'high'
  return 'medium'
}

export const reducedMotion = computed(() => isReducedMotion())
