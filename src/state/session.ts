import type { Session } from '@supabase/supabase-js'
import { reactive } from 'vue'
import { toAppError } from '@/data/errors'
import { db } from '@/data/supabase'

export const session = reactive<{ status: 'loading' | 'signedOut' | 'signedIn'; userId: string | null; email: string | null }>({
  status: 'loading', userId: null, email: null,
})

function apply(next: Session | null): void {
  session.userId = next?.user.id ?? null
  session.email = next?.user.email ?? null
  session.status = next ? 'signedIn' : 'signedOut'
}

let unsubscribe: (() => void) | null = null

export async function initSession(): Promise<void> {
  const { data } = await db().auth.getSession()
  apply(data.session)
  unsubscribe?.()
  // Only mutate local state inside the callback; calling other Supabase methods here can deadlock the client.
  const { data: subscription } = db().auth.onAuthStateChange((_event, next) => apply(next))
  unsubscribe = () => subscription.subscription.unsubscribe()
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await db().auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw toAppError(error)
}

/** Sign-in link for an EXISTING account (new accounts cannot self-register: sign-ups are disabled). */
export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await db().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: window.location.origin } })
  if (error) throw toAppError(error)
}

export async function signOut(): Promise<void> {
  const { error } = await db().auth.signOut()
  if (error) throw toAppError(error)
}
