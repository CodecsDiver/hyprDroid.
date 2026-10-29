import { reactive } from 'vue'
import { fetchMe } from '@/data/repos/auth'
import { startEntranceMusic, stopEntranceMusic } from '@/audio/entrance'
import { PEOPLE, setPersona, startLocalBackend } from '@/local/backend'
import { prefs } from './prefs'
import { closePanel } from './ui'
import privateSeed from 'virtual:private-seed'
import type { Me } from '@/shared/types'

export const session = reactive<{
  status: 'loading' | 'signedOut' | 'signedIn' | 'failed'
  me: Me | null
  userId: string | null
  problem: string | null
}>({ status: 'loading', me: null, userId: null, problem: null })

function apply(me: Me | null): void {
  session.me = me
  session.userId = me?.user.id ?? null
  session.status = me ? 'signedIn' : 'signedOut'
}

/** Opens this browser's own copy of the data. There is no sign-in: the first screen just asks who is here. */
export async function initSession(): Promise<void> {
  try {
    await startLocalBackend(privateSeed)
    apply(null)
  } catch (error) {
    session.problem = error instanceof Error ? error.message : String(error)
    session.status = 'failed'
  }
}

export async function chooseWhoIsHere(id: (typeof PEOPLE)[number]['id']): Promise<void> {
  // First, synchronously, while the click still counts: browsers only allow sound that starts from a person's own tap.
  if (prefs.entranceOn && prefs.entranceUrl && prefs.soundOn) startEntranceMusic(prefs.entranceUrl, prefs.volume)
  await setPersona(id)
  apply(await fetchMe())
}

/** Hands the page over to the other person. */
export async function switchPerson(): Promise<void> {
  closePanel()
  stopEntranceMusic()
  await setPersona(null)
  apply(null)
}
