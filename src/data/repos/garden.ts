import { isMoodKey, type MoodKey, type MoodSnapshot } from '@/domain/moods'
import type { GardenPlant } from '@/domain/garden'
import { db } from '../supabase'
import { unwrap } from '../query'

interface MoodRow { user_id: string; mood: string; note: string | null; updated_at: string }
interface PlantRow { id: string; planted_by: string; mood: string; planted_on: string; seed: number; water_count: number; last_watered_at: string | null }

export async function fetchMoods(): Promise<MoodSnapshot[]> {
  const rows = (await unwrap(db().from('moods').select('user_id, mood, note, updated_at'))) as MoodRow[] | null
  return (rows ?? []).filter((row) => isMoodKey(row.mood)).map((row) => ({ userId: row.user_id, mood: row.mood as MoodKey, note: row.note, updatedAt: row.updated_at }))
}

export async function setMood(mood: MoodKey, note: string): Promise<void> {
  await unwrap(db().rpc('set_mood', { p_mood: mood, p_note: note || null }))
}

export async function fetchPlants(): Promise<GardenPlant[]> {
  const rows = (await unwrap(db().from('garden_plants').select('*').order('created_at', { ascending: false }).limit(64))) as PlantRow[] | null
  return (rows ?? []).filter((row) => isMoodKey(row.mood)).map((row) => ({
    id: row.id, plantedBy: row.planted_by, mood: row.mood as MoodKey, plantedOn: row.planted_on, seed: row.seed,
    waterCount: row.water_count, lastWateredAt: row.last_watered_at,
  }))
}

/** `<plantId>:<userId>` keys for plants already watered today (UTC), to disable the button. */
export async function fetchWateredToday(): Promise<Set<string>> {
  const today = new Date().toISOString().slice(0, 10)
  const rows = (await unwrap(db().from('garden_waterings').select('plant_id, user_id').eq('watered_on', today))) as { plant_id: string; user_id: string }[] | null
  return new Set((rows ?? []).map((row) => `${row.plant_id}:${row.user_id}`))
}

export async function waterPlant(plantId: string): Promise<void> {
  await unwrap(db().rpc('water_plant', { p_plant: plantId }))
}
