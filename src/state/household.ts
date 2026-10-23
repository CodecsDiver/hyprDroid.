import { computed, reactive } from 'vue'
import { fetchMembership, type Membership, type Profile } from '@/data/repos/household'
import { DEFAULT_SETTINGS, fetchBondXp, fetchSettings, saveSettings, type UserSettings } from '@/data/repos/settings'
import { toAppError } from '@/data/errors'
import { personaFor, type Persona } from '@/domain/people'

export const home = reactive<{
  status: 'idle' | 'loading' | 'none' | 'ready' | 'error'
  household: Membership['household']
  me: Profile | null
  partner: Profile | null
  pendingInvite: Membership['pendingInvite']
  settings: UserSettings
  bondXp: number
  error: string | null
}>({ status: 'idle', household: null, me: null, partner: null, pendingInvite: null, settings: { ...DEFAULT_SETTINGS }, bondXp: 0, error: null })

export const partnerName = computed(() => home.partner?.displayName ?? 'your partner')
export const myName = computed(() => home.me?.displayName ?? 'You')
export const myPersona = computed<Persona | null>(() => personaFor(home.me?.displayName))
export const partnerPersona = computed<Persona | null>(() => personaFor(home.partner?.displayName))

export async function loadHome(userId: string): Promise<void> {
  home.status = 'loading'
  home.error = null
  try {
    const membership = await fetchMembership(userId)
    home.me = membership.me
    home.partner = membership.partner
    home.household = membership.household
    home.pendingInvite = membership.pendingInvite
    if (!membership.household) {
      home.status = 'none'
      return
    }
    const [settings, bondXp] = await Promise.all([fetchSettings(userId), fetchBondXp(membership.household.id)])
    home.settings = settings
    home.bondXp = bondXp
    home.status = 'ready'
  } catch (error) {
    home.error = toAppError(error).userMessage
    home.status = 'error'
  }
}

export async function refreshBondXp(): Promise<void> {
  if (!home.household) return
  try {
    home.bondXp = await fetchBondXp(home.household.id)
  } catch {
    /* non-critical */
  }
}

export async function updateSettings(userId: string, changes: Partial<UserSettings>): Promise<void> {
  const previous = { ...home.settings }
  Object.assign(home.settings, changes) // optimistic
  try {
    home.settings = await saveSettings(userId, changes)
  } catch (error) {
    home.settings = previous
    throw error
  }
}

export function resetHome(): void {
  Object.assign(home, { status: 'idle', household: null, me: null, partner: null, pendingInvite: null, settings: { ...DEFAULT_SETTINGS }, bondXp: 0, error: null })
}
