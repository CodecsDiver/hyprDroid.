<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PanelShell from '@/components/PanelShell.vue'
import { cues, playSfx } from '@/audio/engine'
import { fetchWateredToday, setMood, waterPlant } from '@/data/repos/garden'
import { canWaterToday, plantStage, type PlantPlacement } from '@/domain/garden'
import { MOOD_KEYS, MOODS, type MoodKey } from '@/domain/moods'
import { home, myName, partnerName } from '@/state/household'
import { environment, moods, refreshMoods } from '@/state/moods'
import { gardenPlacements, plants, refreshPlants } from '@/state/gardenState'
import { session } from '@/state/session'
import { useAction, useResource } from '@/state/useAsync'
import type { PanelDefinition } from '../panels'
import { bloomShapes } from './glyphs'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const note = ref('')
const selectedId = ref<string | null>(null)
const watered = useResource(fetchWateredToday, new Set<string>(), ['garden_plants'])
onMounted(() => void Promise.all([refreshMoods(), refreshPlants()]).catch(() => {}))

const mine = computed(() => moods.value.find((m) => m.userId === session.userId))
const theirs = computed(() => moods.value.find((m) => m.userId === home.partner?.id))
const selected = computed(() => gardenPlacements.value.find((p) => p.plant.id === selectedId.value) ?? null)
const planterName = (userId: string): string => (userId === session.userId ? myName.value : partnerName.value)

const chooseMood = useAction(async (mood: MoodKey) => {
  await setMood(mood, note.value.trim())
  note.value = ''
  cues.sparkleArpeggio()
  await Promise.all([refreshMoods(), refreshPlants()])
})

const water = useAction(async (placement: PlannedPlacement) => {
  await waterPlant(placement.plant.id)
  playSfx('pop')
  await Promise.all([refreshPlants(), watered.reload()])
})
type PlannedPlacement = PlantPlacement

const weatherLabels: Record<string, string> = {
  clear: 'Clear sky', rain: 'Soft rain', candle: 'Candlelight', starlight: 'Starlight', sunrise: 'Sunrise', hearts: 'Drifting hearts', busy: 'Warm and busy', sparkle: 'Sparkles', cozy: 'Cozy glow',
}
const skyClass = computed(() => `sky--${environment.value.weather}`)
const speciesName = (p: PlannedPlacement): string => p.species

function select(placement: PlannedPlacement): void {
  selectedId.value = placement.plant.id
}
</script>

<template>
  <PanelShell :title="definition.title" :icon="definition.icon" @close="$emit('close')">
    <div class="stack">
      <section aria-labelledby="mood-h" class="stack">
        <h3 id="mood-h">How are you feeling?</h3>
        <div class="moods" role="group" aria-label="Choose your mood">
          <button v-for="key in MOOD_KEYS" :key="key" type="button" class="btn mood" :aria-pressed="mine?.mood === key" :disabled="chooseMood.busy.value" @click="chooseMood.run(key)">
            <span aria-hidden="true">{{ MOODS[key].emoji }}</span> {{ MOODS[key].label }}
          </button>
        </div>
        <div class="field">
          <label for="mood-note">A little note with it (optional)</label>
          <input id="mood-note" v-model="note" class="input" maxlength="140" autocomplete="off" />
        </div>
        <ul class="people" role="list">
          <li class="card"><strong>{{ myName }}</strong>: <span v-if="mine">{{ MOODS[mine.mood].emoji }} {{ MOODS[mine.mood].label }}<em v-if="mine.note"> — “{{ mine.note }}”</em></span><span v-else class="hint">no mood yet</span></li>
          <li class="card"><strong>{{ partnerName }}</strong>: <span v-if="theirs">{{ MOODS[theirs.mood].emoji }} {{ MOODS[theirs.mood].label }}<em v-if="theirs.note"> — “{{ theirs.note }}”</em></span><span v-else class="hint">no mood yet</span></li>
        </ul>
        <p class="hint">Today's weather in the room: <strong>{{ weatherLabels[environment.weather] }}</strong>. The first mood you set each day plants a seed.</p>
      </section>

      <section aria-labelledby="garden-h" class="stack">
        <h3 id="garden-h">Your garden</h3>
        <div class="garden" :class="skyClass">
          <svg viewBox="0 0 800 400" role="group" aria-label="Garden. Each plant is a button; the list below has the same plants." preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b2f22" /><stop offset="1" stop-color="#2a1a14" /></linearGradient>
            </defs>
            <rect x="0" y="250" width="800" height="150" fill="url(#soil)" />
            <g v-for="placement in gardenPlacements" :key="placement.plant.id" class="plant" :class="{ 'plant--selected': placement.plant.id === selectedId }" role="button" tabindex="0"
               :aria-label="`${speciesName(placement)}, planted by ${planterName(placement.plant.plantedBy)} on ${placement.plant.plantedOn}, watered ${placement.plant.waterCount} times`"
               :transform="`translate(${40 + placement.x * 720}, ${230 + placement.y * 130})`" @click="select(placement)" @keydown.enter.prevent="select(placement)" @keydown.space.prevent="select(placement)">
              <line x1="0" y1="0" x2="0" :y2="-(14 + placement.stage * 16)" stroke="#3f9a56" stroke-width="3" stroke-linecap="round" />
              <g :transform="`translate(0, ${-(14 + placement.stage * 16)})`">
                <template v-for="(shape, i) in bloomShapes(placement.species, placement.color, placement.stage)" :key="i">
                  <circle v-if="shape.kind === 'circle'" :cx="shape.cx" :cy="shape.cy" :r="shape.r" :fill="shape.fill" :opacity="shape.opacity ?? 1" />
                  <ellipse v-else :cx="shape.cx" :cy="shape.cy" :rx="shape.rx" :ry="shape.ry" :fill="shape.fill" :opacity="shape.opacity ?? 1" :transform="`rotate(${shape.rotate ?? 0} ${shape.cx} ${shape.cy})`" />
                </template>
              </g>
              <rect x="-22" y="-80" width="44" height="90" fill="transparent" />
            </g>
          </svg>
          <p v-if="gardenPlacements.length === 0" class="garden__empty">Pick a mood to plant your first seed.</p>
        </div>

        <div v-if="selected" class="card stack" role="region" aria-label="Selected plant">
          <p><strong>{{ selected.species }}</strong> · {{ MOODS[selected.plant.mood].emoji }} {{ MOODS[selected.plant.mood].label }}</p>
          <p class="hint">Planted by {{ planterName(selected.plant.plantedBy) }} on {{ selected.plant.plantedOn }}. Stage {{ plantStage(selected.plant.waterCount) }} of 4 · watered {{ selected.plant.waterCount }} time{{ selected.plant.waterCount === 1 ? '' : 's' }}.</p>
          <button type="button" class="btn btn--primary" :disabled="water.busy.value || !session.userId || !canWaterToday(selected.plant, session.userId, watered.data.value)" @click="water.run(selected)">
            {{ session.userId && canWaterToday(selected.plant, session.userId, watered.data.value) ? '💧 Water it' : '💧 Watered today' }}
          </button>
        </div>

        <details>
          <summary>All plants as a list ({{ plants.length }})</summary>
          <ul class="plain" role="list">
            <li v-for="placement in gardenPlacements" :key="placement.plant.id">
              <button type="button" class="btn btn--small btn--quiet" @click="select(placement)">{{ placement.species }} — {{ placement.plant.plantedOn }}</button>
            </li>
          </ul>
        </details>
        <p class="hint">The garden is stored on your server, shared by both of you, so it looks the same on both devices and survives reloads.</p>
      </section>
    </div>
  </PanelShell>
</template>

<style scoped>
.moods { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
.mood { justify-content: flex-start; text-align: left; font-size: var(--text-sm); }
.people { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); font-size: var(--text-sm); }
.garden { position: relative; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--line-soft); background: linear-gradient(180deg, #274a7a, #3a6a9a 60%); }
.garden svg { display: block; width: 100%; height: auto; aspect-ratio: 2 / 1; }
.garden__empty { position: absolute; inset: auto 0 12% 0; margin: 0; text-align: center; font-size: var(--text-sm); }
.sky--rain { background: linear-gradient(180deg, #2a3550, #4a5a78 60%); }
.sky--starlight, .sky--candle { background: linear-gradient(180deg, #0d0a2e, #2a2060 60%); }
.sky--sunrise { background: linear-gradient(180deg, #ff9f6b, #ffd27a 60%); }
.sky--hearts { background: linear-gradient(180deg, #6a3a68, #b06a98 60%); }
.sky--clear, .sky--sparkle, .sky--cozy, .sky--busy { background: linear-gradient(180deg, #274a7a, #5a8ab0 60%); }
.plant { cursor: pointer; }
.plant:focus-visible { outline: none; }
.plant:focus-visible rect, .plant--selected rect { stroke: var(--color-gold); stroke-width: 2; stroke-dasharray: 4 3; }
.plain { list-style: none; padding: 0; margin: var(--space-2) 0 0; display: flex; flex-wrap: wrap; gap: var(--space-1); }
</style>
