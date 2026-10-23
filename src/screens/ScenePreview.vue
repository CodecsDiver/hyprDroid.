<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { DEFAULT_MANIFEST, createAssetResolver } from '@/assets/manifest'
import { deriveEnvironment } from '@/domain/environment'
import { layoutGarden, type GardenPlant } from '@/domain/garden'
import { MOOD_KEYS, MOODS, type MoodKey } from '@/domain/moods'
import { roseProgress } from '@/domain/rose'
import { INTERACTIONS, getInteraction, noteTargets } from '@/registry/interactionRegistry'
import type { SceneController } from '@/scene/SceneController'
import { prefs } from '@/state/prefs'
import { resolveQuality } from '@/state/prefs'

/**
 * Backend-free preview of the 3D room for design and QA. Everything shown here is
 * DEMO DATA on PLACEHOLDER geometry — it is not connected to any household.
 */

const host = ref<HTMLElement | null>(null)
const scene = shallowRef<SceneController | null>(null)
const mood = ref<MoodKey | 'none'>('none')
const hour = ref(21)
const xp = ref(40)
const beacons = ref(false)
const demoGarden = ref(true)
const reduced = ref(false)
const selected = ref<string | null>(null)
const note = ref('')
const error = ref('')

const plants: GardenPlant[] = MOOD_KEYS.flatMap((key, index) =>
  [0, 1, 2].map((n): GardenPlant => ({
    id: `demo-${key}-${n}`, plantedBy: 'demo', mood: key, plantedOn: `2025-01-${String(index * 3 + n + 1).padStart(2, '0')}`,
    seed: (index * 31 + n * 7 + 3) * 2654435761 % 2147483647, waterCount: (index + n) % 8, lastWateredAt: null,
  })),
)

function apply(): void {
  const s = scene.value
  if (!s) return
  const now = new Date(2025, 5, 1, hour.value, 0, 0)
  const moods = mood.value === 'none' ? [] : [{ userId: 'demo', mood: mood.value, updatedAt: now.toISOString() }]
  s.setEnvironment(deriveEnvironment({ moods, now, lampOn: false }))
  s.setRoseStage(roseProgress(xp.value).stage)
  s.setUnreadNotes(new Map(beacons.value ? noteTargets().slice(0, 4).map((d, i) => [d.id, i + 1] as const) : []))
  s.setGarden(demoGarden.value ? layoutGarden(plants) : [])
}

onMounted(async () => {
  if (!host.value) return
  prefs.motion = 'auto'
  try {
    const { SceneController } = await import('@/scene/SceneController')
    scene.value = await SceneController.create({
      host: host.value, manifest: DEFAULT_MANIFEST, resolver: createAssetResolver(async () => ''), quality: resolveQuality(),
      isReducedMotion: () => reduced.value || prefs.motion === 'reduced',
      onSelect: (id) => select(id), onHover: () => {},
    })
    apply()
  } catch (caught) {
    error.value = String(caught)
  }
})
onBeforeUnmount(() => scene.value?.dispose())

function select(id: string): void {
  selected.value = id
  const def = getInteraction(id)
  note.value = def ? `${def.label} → ${def.behavior.type === 'panel' ? `opens the “${def.behavior.panel}” panel` : `runs “${def.behavior.action}”`}` : ''
  scene.value?.setSelected(id)
  scene.value?.pulse(id)
  scene.value?.focusObject(id)
}

function reset(): void {
  selected.value = null
  note.value = ''
  scene.value?.setSelected(null)
  scene.value?.focusObject(null)
}

watch([mood, hour, xp, beacons, demoGarden], apply)
</script>

<template>
  <div class="preview">
    <div ref="host" class="preview__scene" />
    <aside class="preview__bar card" aria-label="Preview controls">
      <p class="preview__warn"><strong>Scene preview</strong> — placeholder geometry and demo data. Not connected to a household.</p>
      <div class="row">
        <label>Mood
          <select v-model="mood" class="input">
            <option value="none">none (clear)</option>
            <option v-for="key in MOOD_KEYS" :key="key" :value="key">{{ key }} — {{ MOODS[key].weather }}</option>
          </select>
        </label>
        <label>Hour {{ hour }}<input v-model.number="hour" type="range" min="0" max="23" /></label>
        <label>Rose XP {{ xp }}<input v-model.number="xp" type="range" min="0" max="200" /></label>
      </div>
      <div class="row">
        <label><input v-model="beacons" type="checkbox" /> unread-note beacons</label>
        <label><input v-model="demoGarden" type="checkbox" /> demo garden</label>
        <label><input v-model="reduced" type="checkbox" /> reduced motion</label>
        <button type="button" class="btn btn--small" @click="reset">Reset camera</button>
      </div>
      <p class="hint" role="status">{{ error || note || 'Tap an object. Drag to turn the room, pinch or scroll to zoom.' }}</p>
      <ul class="preview__ids" role="list"><li v-for="d in INTERACTIONS" :key="d.id"><button type="button" class="btn btn--small" @click="select(d.id)">{{ d.id }}</button></li></ul>
      <span data-testid="selected">{{ selected }}</span>
    </aside>
  </div>
</template>

<style scoped>
.preview { position: absolute; inset: 0; }
.preview__scene { position: absolute; inset: 0; }
.preview__bar { position: absolute; left: var(--space-3); right: var(--space-3); bottom: var(--space-3); max-width: 760px; margin-inline: auto; display: grid; gap: var(--space-2); background: var(--surface-panel); max-height: 44dvh; overflow: auto; font-size: var(--text-sm); }
.preview__bar label { display: grid; gap: 2px; font-size: var(--text-xs); }
.preview__warn { margin: 0; color: var(--color-gold); }
.preview__ids { display: flex; flex-wrap: wrap; gap: var(--space-1); list-style: none; padding: 0; margin: 0; }
[data-testid='selected'] { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
