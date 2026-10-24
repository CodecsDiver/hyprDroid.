<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  text: string
  indent: number
  number?: number
  /** Opponent lines use the cool palette. */
  tone?: 'you' | 'bot'
}>()

/** Fixed, spread-out spark positions so the sparkle looks random but never jumps around between renders. */
const SPARKS = [
  { x: '6%', y: '-30%', delay: '0s', size: 10 },
  { x: '24%', y: '70%', delay: '0.5s', size: 8 },
  { x: '47%', y: '-20%', delay: '1.1s', size: 12 },
  { x: '66%', y: '65%', delay: '0.3s', size: 9 },
  { x: '83%', y: '-25%', delay: '0.8s', size: 11 },
  { x: '95%', y: '60%', delay: '1.4s', size: 8 },
]
const sparks = computed(() => (props.tone === 'bot' ? SPARKS.slice(0, 2) : SPARKS))
</script>

<template>
  <div class="shimmer-line" :class="tone ?? 'you'">
    <span v-if="number !== undefined" class="num">{{ number }}</span>
    <code><span class="pad">{{ ' '.repeat(indent) }}</span>{{ text }}</code>
    <i v-for="(spark, index) in sparks" :key="index" class="spark" :style="{ left: spark.x, top: spark.y, animationDelay: spark.delay, fontSize: `${spark.size}px` }">✦</i>
  </div>
</template>

<style scoped>
.shimmer-line { position: relative; display: flex; gap: 12px; align-items: baseline; padding: 1px 8px; font-family: var(--font-editor); font-size: 16px; line-height: 1.65; white-space: pre; overflow: hidden; }
.num { width: 22px; text-align: right; color: var(--text-dim); font-size: 12px; }
code {
  font: inherit;
  background-size: 260% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: sweep 2.6s linear infinite;
}
.you code {
  background-image: linear-gradient(100deg, var(--neon-green) 0%, var(--neon-green) 30%, var(--flash) 45%, var(--neon-cyan) 58%, var(--neon-green) 72%, var(--neon-green) 100%);
  filter: drop-shadow(0 0 calc(5px * var(--fx-scale)) rgb(var(--neon-green-rgb) / 0.75));
}
.bot code {
  background-image: linear-gradient(100deg, var(--neon-violet) 0%, var(--neon-violet) 35%, var(--flash) 50%, var(--neon-violet) 65%, var(--neon-violet) 100%);
  filter: drop-shadow(0 0 calc(3px * var(--fx-scale)) rgb(var(--neon-violet-rgb) / 0.6));
  opacity: 0.85;
}
.you::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; opacity: calc(0.5 * var(--fx-scale));
  background: linear-gradient(100deg, transparent 20%, rgb(var(--neon-cyan-rgb) / 0.16) 48%, transparent 76%);
  background-size: 260% 100%; animation: sweep 2.6s linear infinite;
}
.pad { white-space: pre; }
.spark { position: absolute; color: var(--flash); text-shadow: 0 0 calc(8px * var(--fx-scale)) var(--neon-cyan); opacity: 0; animation: twinkle 1.7s ease-in-out infinite; pointer-events: none; font-style: normal; }
@keyframes sweep { from { background-position: 160% 0; } to { background-position: -100% 0; } }
@keyframes twinkle { 0%, 100% { opacity: 0; transform: scale(0.3) rotate(0deg); } 45% { opacity: 1; transform: scale(1.2) rotate(35deg); } 70% { opacity: 0.3; transform: scale(0.7) rotate(60deg); } }
:root[data-fx='off'] code, :root[data-fx='off'] .you::after, :root[data-fx='off'] .spark { animation: none; }
:root[data-fx='off'] code { color: var(--neon-green); background: none; }
@media (prefers-reduced-motion: reduce) { code, .you::after, .spark { animation: none; } }
</style>
