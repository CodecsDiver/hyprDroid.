<script setup lang="ts">
import { computed, ref } from 'vue'
import { binarySearchFrames } from '../algorithms/binarySearch'
import PlayerControls from '../PlayerControls.vue'
import { useStepPlayer } from '../useStepPlayer'

const emit = defineEmits<{ studied: [] }>()

const sortedValues = Array.from({ length: 31 }, (_, index) => 3 + index * 3 + (index % 4))
const target = ref(sortedValues[22])

const player = useStepPlayer(() => binarySearchFrames(sortedValues, target.value), () => emit('studied'))

function pickRandomTarget(): void {
  const presentValue = sortedValues[Math.floor(Math.random() * sortedValues.length)]
  target.value = Math.random() < 0.2 ? presentValue + 1 : presentValue
}

const linearSteps = computed(() => {
  const found = sortedValues.indexOf(target.value)
  return found === -1 ? sortedValues.length : found + 1
})

function cellClass(index: number): string {
  const frame = player.frame.value
  if (frame.foundIndex === index) return 'found'
  if (frame.middle === index) return 'middle'
  if (index < frame.low || index > frame.high) return 'discarded'
  return 'candidate'
}
</script>

<template>
  <div class="viz">
    <div class="toolbar">
      <label>TARGET <input v-model.number="target" type="number" min="0" max="120" /></label>
      <button class="btn is-ghost" @click="pickRandomTarget">Random target</button>
      <span class="compare">
        binary: <b>{{ player.frame.value.steps }}</b> comparisons so far &middot; linear scan would need up to <b>{{ linearSteps }}</b>
      </span>
    </div>

    <div class="grid">
      <div v-for="(value, index) in sortedValues" :key="index" class="cell" :class="cellClass(index)">
        <span class="value">{{ value }}</span>
        <span class="marker">
          <template v-if="player.frame.value.middle === index">MID</template>
          <template v-else-if="player.frame.value.low === index">LOW</template>
          <template v-else-if="player.frame.value.high === index">HIGH</template>
        </span>
      </div>
    </div>

    <PlayerControls :player="player" :note="player.frame.value.note" />
  </div>
</template>

<style scoped>
.viz { display: flex; flex-direction: column; gap: 16px; }
.toolbar { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.toolbar label { display: flex; align-items: center; gap: 8px; font-size: 10px; letter-spacing: 0.18em; color: var(--text-dim); }
input[type='number'] { width: 80px; background: var(--hull-raised); color: var(--neon-amber); border: 1px solid var(--glass-edge); padding: 6px 8px; font-family: inherit; font-size: 15px; }
.compare { margin-left: auto; color: var(--text-dim); }
.compare b { color: var(--neon-green); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(54px, 1fr)); gap: 8px; padding: 16px; background: rgba(4, 5, 10, 0.7); border: 1px solid rgba(25, 230, 255, 0.2); }
.cell { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 0 6px; border: 1px solid rgba(113, 134, 160, 0.4); transition: opacity 0.25s, transform 0.25s, background 0.25s; }
.value { font-size: 16px; font-weight: 700; }
.marker { height: 12px; font-size: 9px; letter-spacing: 0.18em; color: var(--neon-cyan); }
.cell.discarded { opacity: 0.18; transform: scale(0.92); }
.cell.candidate { border-color: var(--neon-cyan); background: rgba(25, 230, 255, 0.06); }
.cell.middle { border-color: var(--neon-amber); background: rgba(255, 200, 61, 0.18); box-shadow: 0 0 calc(16px * var(--fx-scale)) var(--neon-amber); transform: translateY(-6px); }
.cell.found { border-color: var(--neon-green); background: rgba(57, 255, 136, 0.25); box-shadow: var(--glow-green); transform: translateY(-8px) scale(1.08); }
</style>
