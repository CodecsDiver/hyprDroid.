<script setup lang="ts">
import { computed, ref } from 'vue'
import { randomValues, SORT_ALGORITHMS, sortFrames, type SortAlgorithmId } from '../algorithms/sorting'
import PlayerControls from '../PlayerControls.vue'
import { useStepPlayer } from '../useStepPlayer'

const emit = defineEmits<{ studied: [] }>()

const algorithm = ref<SortAlgorithmId>('bubble')
const size = ref(18)
const values = ref(randomValues(size.value))

const frames = computed(() => sortFrames(algorithm.value, values.value))
const player = useStepPlayer(() => frames.value, () => emit('studied'))
const algorithmInfo = computed(() => SORT_ALGORITHMS.find((entry) => entry.id === algorithm.value)!)

function shuffle(): void {
  values.value = randomValues(size.value)
}

function barClass(index: number): string {
  const frame = player.frame.value
  if (frame.active.includes(index)) return 'active'
  if (frame.settled.includes(index)) return 'settled'
  return ''
}
</script>

<template>
  <div class="viz">
    <div class="toolbar">
      <label>ALGORITHM
        <select v-model="algorithm">
          <option v-for="entry in SORT_ALGORITHMS" :key="entry.id" :value="entry.id">{{ entry.label }}</option>
        </select>
      </label>
      <label>ITEMS {{ size }}
        <input v-model.number="size" type="range" min="6" max="40" @input="shuffle" />
      </label>
      <button class="btn is-ghost" @click="shuffle">Shuffle</button>
      <span class="complexity">{{ algorithmInfo.complexity }}</span>
    </div>

    <div class="stage">
      <div
        v-for="(value, index) in player.frame.value.values"
        :key="index"
        class="bar"
        :class="barClass(index)"
        :style="{ height: `${value}%`, width: `${100 / player.frame.value.values.length}%` }"
      >
        <span v-if="player.frame.value.values.length <= 20" class="bar-label">{{ value }}</span>
      </div>
    </div>

    <PlayerControls :player="player" :note="player.frame.value.note" />
  </div>
</template>

<style scoped>
.viz { display: flex; flex-direction: column; gap: 16px; height: 100%; }
.toolbar { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.toolbar label { display: flex; align-items: center; gap: 8px; font-size: 10px; letter-spacing: 0.18em; color: var(--text-dim); }
select { background: var(--hull-raised); color: var(--text); border: 1px solid var(--glass-edge); padding: 6px 10px; font-family: inherit; }
input[type='range'] { accent-color: var(--neon-violet); }
.complexity { margin-left: auto; color: var(--neon-amber); font-weight: 700; }
.stage { flex: 1; min-height: 220px; display: flex; align-items: flex-end; gap: 2px; padding: 12px; background: rgba(4, 5, 10, 0.7); border: 1px solid rgba(25, 230, 255, 0.2); }
.bar { position: relative; background: linear-gradient(180deg, var(--neon-violet), rgba(164, 92, 255, 0.35)); transition: height 0.12s, background 0.12s; }
.bar.active { background: linear-gradient(180deg, var(--neon-amber), rgba(255, 200, 61, 0.4)); box-shadow: 0 0 calc(14px * var(--fx-scale)) var(--neon-amber); }
.bar.settled { background: linear-gradient(180deg, var(--neon-green), rgba(57, 255, 136, 0.35)); }
.bar-label { position: absolute; top: -18px; left: 0; right: 0; text-align: center; font-size: 10px; color: var(--text-dim); }
</style>
