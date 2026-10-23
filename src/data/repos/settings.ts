import { DEFAULT_SETTINGS, type UserSettings } from '@/shared/types'
import { api } from '../api'

export { DEFAULT_SETTINGS }
export type { UserSettings }

export const fetchSettings = (): Promise<UserSettings> => api.get<UserSettings>('/settings')
export const saveSettings = (changes: Partial<UserSettings>): Promise<UserSettings> => api.put<UserSettings>('/settings', changes)
export async function fetchBondXp(): Promise<number> {
  return (await api.get<{ bondXp: number }>('/state/bond')).bondXp
}

/** True when `hour` falls inside the quiet-hours window (which may wrap past midnight). */
export function inQuietHours(settings: Pick<UserSettings, 'quietHoursStart' | 'quietHoursEnd'>, hour: number): boolean {
  const { quietHoursStart: start, quietHoursEnd: end } = settings
  if (start === null || end === null || start === end) return false
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}
