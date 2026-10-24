<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ active: boolean }>()
const emit = defineEmits<{ go: [] }>()

const STEPS = ['3', '2', '1', 'GO!'] as const
const stepIndex = ref(-1)
let timer: ReturnType<typeof setTimeout> | undefined

function advance(): void {
  stepIndex.value += 1
  if (stepIndex.value >= STEPS.length) {
    stepIndex.value = -1
    return
  }
  if (stepIndex.value === STEPS.length - 1) emit('go')
  timer = setTimeout(advance, stepIndex.value === STEPS.length - 1 ? 700 : 850)
}

watch(
  () => props.active,
  (active) => {
    clearTimeout(timer)
    stepIndex.value = -1
    if (active) advance()
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div v-if="stepIndex >= 0" class="countdown" aria-live="assertive">
    <span :key="stepIndex" class="digit" :class="{ go: stepIndex === STEPS.length - 1 }">{{ STEPS[stepIndex] }}</span>
  </div>
</template>

<style scoped>
.countdown { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; pointer-events: none; background: rgb(var(--void-rgb) / 0.55); }
.digit {
  font-family: var(--font-display); font-weight: 900; font-size: min(26vw, 220px); line-height: 1; color: var(--neon-cyan);
  text-shadow: 0 0 calc(30px * var(--fx-scale)) var(--neon-cyan), 0 0 calc(80px * var(--fx-scale)) var(--neon-violet);
  animation: count-pop 0.85s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.digit.go { color: var(--neon-green); text-shadow: 0 0 calc(40px * var(--fx-scale)) var(--neon-green), 0 0 calc(110px * var(--fx-scale)) var(--neon-cyan); animation-duration: 0.7s; }
@keyframes count-pop {
  0% { transform: scale(2.2); opacity: 0; }
  35% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.85); opacity: 0.1; }
}
:root[data-fx='off'] .digit { animation: none; }
</style>
