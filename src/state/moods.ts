import { computed, onScopeDispose, ref } from 'vue'
import { fetchMoods } from '@/data/repos/garden'
import { deriveEnvironment } from '@/domain/environment'
import type { MischiefConsent } from '@/domain/mischief'
import type { MoodSnapshot } from '@/domain/moods'
import { home } from './household'
import { prefs } from './prefs'

export const moods = ref<MoodSnapshot[]>([])
const now = ref(new Date())

export async function refreshMoods(): Promise<void> {
  moods.value = await fetchMoods()
}

let timer: ReturnType<typeof setInterval> | null = null
/** Re-derives the environment as the day moves on (dawn → day → dusk → night, mood expiry). */
export function startEnvironmentClock(): void {
  if (timer) return
  timer = setInterval(() => (now.value = new Date()), 60_000)
}

export function stopEnvironmentClock(): void {
  if (timer) clearInterval(timer)
  timer = null
}

export const environment = computed(() => deriveEnvironment({ moods: moods.value, now: now.value, lampOn: prefs.lampOn }))

export const mischiefConsent = computed<MischiefConsent>(() => ({
  allowMischief: home.settings.allowMischief,
  allowDisruptive: home.settings.allowDisruptiveMischief,
  paused: prefs.mischiefPaused,
}))

export function useEnvironmentClock(): void {
  startEnvironmentClock()
  onScopeDispose(stopEnvironmentClock)
}
