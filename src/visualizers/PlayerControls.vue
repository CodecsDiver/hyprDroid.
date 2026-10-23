<script setup lang="ts">
import type { StepPlayer } from './useStepPlayer'

defineProps<{ player: StepPlayer<unknown>; note: string }>()
</script>

<template>
  <div class="controls">
    <div class="buttons">
      <button class="btn is-ghost" :disabled="player.frameIndex.value === 0" title="Restart" @click="player.restart()">&#8634;</button>
      <button class="btn is-ghost" :disabled="player.frameIndex.value === 0" title="Step back" @click="player.stepBack()">&#9664;</button>
      <button class="btn is-green" @click="player.togglePlay()">{{ player.isPlaying.value ? 'Pause' : player.isAtEnd.value ? 'Replay' : 'Play' }}</button>
      <button class="btn is-ghost" :disabled="player.isAtEnd.value" title="Step forward" @click="player.stepForward()">&#9654;</button>
      <label class="speed">
        <span>SPEED</span>
        <input v-model.number="player.stepDelayMs.value" type="range" min="30" max="900" step="10" dir="rtl" />
      </label>
      <span class="counter">{{ player.frameIndex.value + 1 }} / {{ player.frameCount.value }}</span>
    </div>
    <div class="timeline"><div class="timeline-fill" :style="{ transform: `scaleX(${(player.frameIndex.value + 1) / player.frameCount.value})` }" /></div>
    <div class="note">&gt; {{ note }}</div>
  </div>
</template>

<style scoped>
.controls { display: flex; flex-direction: column; gap: 10px; }
.buttons { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.speed { display: flex; align-items: center; gap: 8px; margin-left: 10px; font-size: 10px; letter-spacing: 0.2em; color: var(--text-dim); }
.speed input { accent-color: var(--neon-cyan); width: 120px; }
.counter { margin-left: auto; color: var(--text-dim); font-size: 12px; }
.timeline { height: 4px; background: rgba(255, 255, 255, 0.08); }
.timeline-fill { height: 100%; transform-origin: left; background: linear-gradient(90deg, var(--neon-green), var(--neon-cyan)); transition: transform 0.1s linear; }
.note { min-height: 20px; color: var(--neon-cyan); }
</style>
