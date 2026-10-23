import { db } from '../supabase'
import { unwrap, unwrapOrNull } from '../query'

export interface Profile {
  id: string
  displayName: string
}

export interface Membership {
  household: { id: string; name: string } | null
  me: Profile | null
  partner: Profile | null
  pendingInvite: { email: string; expiresAt: string } | null
}

interface ProfileRow { id: string; display_name: string }

export async function fetchMembership(userId: string): Promise<Membership> {
  const member = (await unwrapOrNull(
    db().from('household_members').select('household_id, households(id, name)').eq('user_id', userId).maybeSingle(),
  )) as unknown as { household_id: string; households: unknown } | null
  const profiles = await unwrap(db().from('profiles').select('id, display_name'))
  const rows = (profiles ?? []) as ProfileRow[]
  const toProfile = (row: ProfileRow | undefined): Profile | null => (row ? { id: row.id, displayName: row.display_name } : null)
  const me = toProfile(rows.find((row) => row.id === userId))

  if (!member) return { household: null, me, partner: null, pendingInvite: null }
  const households = member.households as unknown as { id: string; name: string } | { id: string; name: string }[] | null
  const household = Array.isArray(households) ? households[0] : households

  const invites = await unwrap(
    db().from('household_invites').select('invited_email, expires_at, accepted_at').is('accepted_at', null).gt('expires_at', new Date().toISOString()).limit(1),
  )
  const invite = (invites as { invited_email: string; expires_at: string }[] | null)?.[0]
  return {
    household: household ? { id: household.id, name: household.name } : null,
    me,
    partner: toProfile(rows.find((row) => row.id !== userId)),
    pendingInvite: invite ? { email: invite.invited_email, expiresAt: invite.expires_at } : null,
  }
}

export async function createHousehold(name: string, displayName: string): Promise<string> {
  return unwrap(db().rpc('create_household', { p_name: name, p_display_name: displayName }))
}

/** Returns the one-time invite token to share with the invited person. */
export async function invitePartner(email: string): Promise<string> {
  return unwrap(db().rpc('invite_partner', { p_email: email }))
}

export async function acceptInvite(token: string): Promise<string> {
  return unwrap(db().rpc('accept_invite', { p_token: token.trim() }))
}

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  await unwrap(db().from('profiles').update({ display_name: displayName }).eq('id', userId))
}
