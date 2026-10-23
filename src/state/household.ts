import { computed, reactive } from 'vue'
import { DEFAULT_SETTINGS, fetchBondXp, fetchSettings, saveSettings, type UserSettings } from '@/data/repos/settings'
import { toAppError } from '@/data/errors'
import { personaFor, type Persona } from '@/domain/people'
import type { PublicUser } from '@/shared/types'

export const home = reactive<{
  status: 'idle' | 'loading' | 'ready' | 'error'
  me: PublicUser | null
  partner: PublicUser | null
  settings: UserSettings
  bondXp: number
  error: string | null
}>({ status: 'idle', me: null, partner: null, settings: { ...DEFAULT_SETTINGS }, bondXp: 0, error: null })

export const partnerName = computed(() => home.partner?.name ?? 'your partner')
export const myName = computed(() => home.me?.name ?? 'You')
export const myPersona = computed<Persona | null>(() => personaFor(home.me?.name))
export const partnerPersona = computed<Persona | null>(() => personaFor(home.partner?.name))

export async function loadHome(me: PublicUser, partner: PublicUser): Promise<void> {
  home.status = 'loading'
  home.error = null
  try {
    const [settings, bondXp] = await Promise.all([fetchSettings(), fetchBondXp()])
    home.me = me
    home.partner = partner
    home.settings = settings
    home.bondXp = bondXp
    home.status = 'ready'
  } catch (error) {
    home.error = toAppError(error).userMessage
    home.status = 'error'
  }
}

export async function refreshBondXp(): Promise<void> {
  try {
    home.bondXp = await fetchBondXp()
  } catch {
    /* non-critical */
  }
}

export async function updateSettings(changes: Partial<UserSettings>): Promise<void> {
  const previous = { ...home.settings }
  Object.assign(home.settings, changes) // optimistic
  try {
    home.settings = await saveSettings(changes)
  } catch (error) {
    home.settings = previous
    throw error
  }
}

export function resetHome(): void {
  Object.assign(home, { status: 'idle', me: null, partner: null, settings: { ...DEFAULT_SETTINGS }, bondXp: 0, error: null })
}
