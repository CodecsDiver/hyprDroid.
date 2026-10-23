<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { describeLevelProgress, type LevelProgress } from '../../gamification/xpCurve'

const props = defineProps<{ totalXp: number }>()

const progress = computed(() => describeLevelProgress(props.totalXp))
const displayedFraction = ref(progress.value.fraction)
const isSnapping = ref(false)
const isFlashing = ref(false)

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Animation updates are queued so rapid XP changes never interleave. Crossing a level fills
 * the bar to 100%, flashes, snaps to empty (transition off) and then climbs to the new position.
 */
let queue: Promise<void> = Promise.resolve()
let isUnmounted = false

async function animateTo(next: LevelProgress, previous: LevelProgress): Promise<void> {
  if (isUnmounted) return
  if (next.level > previous.level) {
    displayedFraction.value = 1
    await wait(560)
    isFlashing.value = true
    isSnapping.value = true
    displayedFraction.value = 0
    await nextTick()
    await wait(50)
    isSnapping.value = false
    await wait(160)
    isFlashing.value = false
  }
  displayedFraction.value = next.fraction
  await wait(120)
}

watch(progress, (next, previous) => {
  queue = queue.then(() => animateTo(next, previous))
})

onBeforeUnmount(() => {
  isUnmounted = true
})
</script>

<template>
  <div class="level-bar" :class="{ flashing: isFlashing }">
    <div class="track">
      <div class="fill" :class="{ snapping: isSnapping }" :style="{ transform: `scaleX(${displayedFraction})` }" />
      <div class="ticks" />
      <span class="readout">{{ progress.xpIntoLevel }} / {{ progress.xpSpanOfLevel }} XP</span>
    </div>
  </div>
</template>

<style scoped>
.level-bar { position: relative; width: 100%; }
.track {
  position: relative;
  height: 22px;
  background: rgba(4, 5, 10, 0.9);
  border: 1px solid rgba(25, 230, 255, 0.4);
  clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
  overflow: hidden;
}
.fill {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  background: linear-gradient(90deg, var(--neon-green), var(--neon-cyan) 55%, var(--neon-violet));
  box-shadow: var(--glow-cyan);
  transition: transform 0.7s cubic-bezier(0.2, 0.9, 0.15, 1);
}
.fill.snapping { transition: none; }
.fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.55) 50%, transparent 70%);
  transform: translateX(-100%);
  animation: sheen calc(2.4s / max(var(--fx-scale), 0.01)) ease-in-out infinite;
}
:root[data-fx='off'] .fill::after { animation: none; }
@keyframes sheen { 0% { transform: translateX(-100%); } 60%, 100% { transform: translateX(100%); } }
.ticks {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(4, 5, 10, 0.55) calc(10% - 1px) 10%);
  pointer-events: none;
}
.readout {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #fff;
  text-shadow: 0 0 4px #000, 0 0 8px #000;
}
.flashing .track {
  animation: level-flash 0.5s ease-out;
}
@keyframes level-flash {
  0% { box-shadow: 0 0 0 0 #fff; filter: brightness(2.4); }
  100% { box-shadow: 0 0 calc(34px * var(--fx-scale)) 6px transparent; filter: brightness(1); }
}
</style>
