import { MOODS, type MoodKey, type PlantSpecies } from './moods'

export interface GardenPlant {
  id: string
  plantedBy: string
  mood: MoodKey
  plantedOn: string
  seed: number
  waterCount: number
  lastWateredAt: string | null
}

export const MAX_PLANT_STAGE = 4
/** Waterings needed to reach stages 1..4 (index = stage). */
const STAGE_WATER_THRESHOLDS = [0, 0, 1, 3, 6] as const

export function plantStage(waterCount: number): number {
  let stage = 1
  for (let s = 2; s <= MAX_PLANT_STAGE; s++) if (waterCount >= (STAGE_WATER_THRESHOLDS[s] ?? Infinity)) stage = s
  return stage
}

export function speciesFor(mood: MoodKey): PlantSpecies {
  return MOODS[mood].plant
}

export interface PlantPlacement {
  plant: GardenPlant
  /** 0..1 across/down the garden bed. */
  x: number
  y: number
  stage: number
  species: PlantSpecies
  color: string
}

export const GARDEN_COLUMNS = 8
export const GARDEN_ROWS = 4
export const GARDEN_CAPACITY = GARDEN_COLUMNS * GARDEN_ROWS

function hash(seed: number): number {
  let h = seed | 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * Deterministic layout: the same plants always land in the same spots on every
 * device, so the garden looks identical to both people and after a reload.
 * Newest plants win when the bed is full.
 */
export function layoutGarden(plants: readonly GardenPlant[]): PlantPlacement[] {
  const newest = [...plants].sort((a, b) => b.plantedOn.localeCompare(a.plantedOn) || a.id.localeCompare(b.id)).slice(0, GARDEN_CAPACITY)
  const taken = new Set<number>()
  const placements: PlantPlacement[] = []
  // Place oldest first so existing plants never move when new ones arrive.
  for (const plant of [...newest].reverse()) {
    let slot = hash(plant.seed) % GARDEN_CAPACITY
    for (let guard = 0; taken.has(slot) && guard < GARDEN_CAPACITY; guard++) slot = (slot + 1) % GARDEN_CAPACITY
    taken.add(slot)
    const column = slot % GARDEN_COLUMNS
    const row = Math.floor(slot / GARDEN_COLUMNS)
    const jitterX = ((hash(plant.seed + 1) % 1000) / 1000 - 0.5) * 0.5
    const jitterY = ((hash(plant.seed + 2) % 1000) / 1000 - 0.5) * 0.5
    placements.push({
      plant,
      x: (column + 0.5 + jitterX) / GARDEN_COLUMNS,
      y: (row + 0.5 + jitterY) / GARDEN_ROWS,
      stage: plantStage(plant.waterCount),
      species: speciesFor(plant.mood),
      color: MOODS[plant.mood].color,
    })
  }
  return placements.sort((a, b) => a.y - b.y)
}

export function canWaterToday(plant: GardenPlant, userId: string, wateredToday: ReadonlySet<string>): boolean {
  return !wateredToday.has(`${plant.id}:${userId}`)
}
