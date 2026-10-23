import type { GardenPlant } from '@/domain/garden'
import type { MoodKey, MoodSnapshot } from '@/domain/moods'
import { api } from '../api'

export const fetchMoods = (): Promise<MoodSnapshot[]> => api.get<MoodSnapshot[]>('/moods')
export const setMood = (mood: MoodKey, note: string): Promise<unknown> => api.post('/moods', { mood, note })
export const fetchPlants = (): Promise<GardenPlant[]> => api.get<GardenPlant[]>('/plants')
/** `<plantId>:<userId>` keys for plants already watered today (UTC), to disable the button. */
export async function fetchWateredToday(): Promise<Set<string>> {
  return new Set(await api.get<string[]>('/plants/watered-today'))
}
export const waterPlant = (plantId: string): Promise<unknown> => api.post(`/plants/${plantId}/water`)
