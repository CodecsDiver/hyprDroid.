import { computed, ref } from 'vue'
import { fetchPlants } from '@/data/repos/garden'
import { layoutGarden, type GardenPlant } from '@/domain/garden'

export const plants = ref<GardenPlant[]>([])

export async function refreshPlants(): Promise<void> {
  plants.value = await fetchPlants()
}

export const gardenPlacements = computed(() => layoutGarden(plants.value))
