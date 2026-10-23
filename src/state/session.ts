import { reactive } from 'vue'
import { setUnauthorizedHandler } from '@/data/api'
import { toAppError } from '@/data/errors'
import { fetchMe, fetchStatus, login, logout } from '@/data/repos/auth'
import type { Me } from '@/shared/types'

export const session = reactive<{
  status: 'loading' | 'signedOut' | 'signedIn' | 'notConfigured'
  me: Me | null
  userId: string | null
  problems: string[]
}>({ status: 'loading', me: null, userId: null, problems: [] })

function apply(me: Me | null): void {
  session.me = me
  session.userId = me?.user.id ?? null
  session.status = me ? 'signedIn' : 'signedOut'
}

/** Asks the server who I am. The session lives in an HttpOnly cookie, so there is nothing to restore client-side. */
export async function initSession(): Promise<void> {
  setUnauthorizedHandler(() => {
    if (session.status === 'signedIn') apply(null)
  })
  try {
    const status = await fetchStatus()
    if (!status.configured) {
      session.problems = status.problems ?? []
      session.status = 'notConfigured'
      return
    }
    apply(await fetchMe())
  } catch (error) {
    const app = toAppError(error)
    if (app.code === 'server_not_configured') {
      session.status = 'notConfigured'
      return
    }
    if (app.code === 'not_authenticated') return apply(null)
    // Offline or the server is unreachable: show the sign-in screen rather than an endless spinner.
    apply(null)
  }
}

export async function signInWithPassword(username: string, password: string): Promise<void> {
  apply(await login(username.trim(), password))
}

export async function signOut(): Promise<void> {
  await logout()
  apply(null)
}
