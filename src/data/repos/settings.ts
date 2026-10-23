import { db } from '../supabase'
import { unwrap } from '../query'

export interface UserSettings {
  notifyLovePings: boolean
  notifyHiddenNotes: boolean
  notifyMischief: boolean
  notifyListeningInvites: boolean
  allowMischief: boolean
  allowDisruptiveMischief: boolean
  quietHoursStart: number | null
  quietHoursEnd: number | null
}

export const DEFAULT_SETTINGS: UserSettings = {
  notifyLovePings: true, notifyHiddenNotes: true, notifyMischief: true, notifyListeningInvites: true,
  allowMischief: false, allowDisruptiveMischief: false, quietHoursStart: null, quietHoursEnd: null,
}

interface Row {
  notify_love_pings: boolean; notify_hidden_notes: boolean; notify_mischief: boolean; notify_listening_invites: boolean
  allow_mischief: boolean; allow_disruptive_mischief: boolean; quiet_hours_start: number | null; quiet_hours_end: number | null
}

const toRow = (s: Partial<UserSettings>): Partial<Row> => ({
  ...(s.notifyLovePings !== undefined && { notify_love_pings: s.notifyLovePings }),
  ...(s.notifyHiddenNotes !== undefined && { notify_hidden_notes: s.notifyHiddenNotes }),
  ...(s.notifyMischief !== undefined && { notify_mischief: s.notifyMischief }),
  ...(s.notifyListeningInvites !== undefined && { notify_listening_invites: s.notifyListeningInvites }),
  ...(s.allowMischief !== undefined && { allow_mischief: s.allowMischief }),
  ...(s.allowDisruptiveMischief !== undefined && { allow_disruptive_mischief: s.allowDisruptiveMischief }),
  ...(s.quietHoursStart !== undefined && { quiet_hours_start: s.quietHoursStart }),
  ...(s.quietHoursEnd !== undefined && { quiet_hours_end: s.quietHoursEnd }),
})

const fromRow = (r: Row): UserSettings => ({
  notifyLovePings: r.notify_love_pings, notifyHiddenNotes: r.notify_hidden_notes, notifyMischief: r.notify_mischief,
  notifyListeningInvites: r.notify_listening_invites, allowMischief: r.allow_mischief,
  allowDisruptiveMischief: r.allow_disruptive_mischief, quietHoursStart: r.quiet_hours_start, quietHoursEnd: r.quiet_hours_end,
})

export async function fetchSettings(userId: string): Promise<UserSettings> {
  const row = (await unwrap(db().from('user_settings').select('*').eq('user_id', userId).maybeSingle())) as unknown as Row | null
  return row ? fromRow(row) : { ...DEFAULT_SETTINGS }
}

export async function saveSettings(userId: string, changes: Partial<UserSettings>): Promise<UserSettings> {
  const row = (await unwrap(db().from('user_settings').update(toRow(changes)).eq('user_id', userId).select('*').single())) as unknown as Row
  return fromRow(row)
}

export async function fetchBondXp(householdId: string): Promise<number> {
  const row = await unwrap(db().from('household_state').select('bond_xp').eq('household_id', householdId).maybeSingle())
  return (row as { bond_xp: number } | null)?.bond_xp ?? 0
}

/** True when `hour` falls inside the quiet-hours window (which may wrap past midnight). */
export function inQuietHours(settings: Pick<UserSettings, 'quietHoursStart' | 'quietHoursEnd'>, hour: number): boolean {
  const { quietHoursStart: start, quietHoursEnd: end } = settings
  if (start === null || end === null || start === end) return false
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}
