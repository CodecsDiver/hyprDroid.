<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { activeEffects, roomEffect, stopRoomEffect, type ActiveEffect } from './bus'

const PETAL = '🌸'
const CONFETTI = ['#ff7aaa', '#ffd98d', '#aef3c3', '#c9a7ff', '#8fb4ff']

watch(() => roomEffect.id, (id) => {
  if (id) document.documentElement.dataset.roomFx = id
  else delete document.documentElement.dataset.roomFx
}, { immediate: true })

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && roomEffect.id) stopRoomEffect()
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  stopRoomEffect()
})

const n = (effect: ActiveEffect, index: number): number => effect.seed[index % effect.seed.length] ?? 0.5

function particleStyle(effect: ActiveEffect, index: number, spread = 100): Record<string, string> {
  return {
    '--x': `${(n(effect, index) - 0.5) * spread}vw`,
    '--y': `${(n(effect, index + 7) - 0.5) * spread}vh`,
    '--d': `${n(effect, index + 3) * 0.6}s`,
    '--s': `${0.7 + n(effect, index + 5) * 0.9}`,
    left: `${10 + n(effect, index + 11) * 80}%`,
  }
}

function calmText(effect: ActiveEffect): string {
  const spec = effect.spec
  switch (spec.type) {
    case 'reaction': return `${spec.emoji} ${spec.label ?? ''}`.trim()
    case 'spell': return spec.name
    case 'mischief': return spec.text ?? ''
    case 'hearts-synced': return '💞 Hearts synced'
    case 'note-card': return spec.text
    default: return ''
  }
}
</script>

<template>
  <div class="fx" aria-hidden="true">
    <template v-for="effect in activeEffects" :key="effect.id">
      <!-- Reduced motion: one calm, static banner instead of movement. -->
      <div v-if="effect.reduced && effect.spec.type !== 'sticker'" class="calm">{{ calmText(effect) }}</div>

      <template v-else-if="effect.spec.type === 'reaction'">
        <template v-if="effect.spec.animation === 'pulse'">
          <div class="pulse" :style="{ '--d': '0s' }">{{ effect.spec.emoji }}</div>
        </template>
        <template v-else>
          <span
            v-for="i in effect.spec.animation === 'burst' ? 12 : 8"
            :key="i"
            class="particle"
            :class="`particle--${effect.spec.animation}`"
            :style="particleStyle(effect, i, effect.spec.animation === 'burst' ? 70 : 60)"
          >{{ effect.spec.emoji }}</span>
        </template>
        <div v-if="effect.spec.label" class="caption">{{ effect.spec.label }}</div>
      </template>

      <template v-else-if="effect.spec.type === 'spell'">
        <div class="glow" :style="{ '--c': effect.spec.color }" />
        <span
          v-for="i in 14"
          :key="i"
          class="particle"
          :class="effect.spec.effect === 'petal_rain' || effect.spec.effect === 'ember_drift' ? 'particle--rain' : effect.spec.effect === 'heart_swirl' ? 'particle--float' : 'particle--burst'"
          :style="{ ...particleStyle(effect, i, 80), color: effect.spec.color }"
        >{{ effect.spec.effect === 'petal_rain' ? PETAL : effect.spec.effect === 'heart_swirl' ? '💜' : effect.spec.effect === 'ember_drift' ? '🔥' : effect.spec.effect === 'starfall' ? '🌠' : '✨' }}</span>
        <div class="caption caption--spell" :style="{ '--c': effect.spec.color }">
          <strong>{{ effect.spec.name }}</strong>
          <span v-if="effect.spec.message">{{ effect.spec.message }}</span>
        </div>
      </template>

      <template v-else-if="effect.spec.type === 'mischief'">
        <template v-if="effect.spec.effect === 'confetti'">
          <span v-for="i in 28" :key="i" class="confetti" :style="{ ...particleStyle(effect, i, 100), background: CONFETTI[i % CONFETTI.length] }" />
        </template>
        <template v-else-if="effect.spec.effect === 'balloons'">
          <span v-for="i in 8" :key="i" class="particle particle--float" :style="particleStyle(effect, i, 60)">🎈</span>
        </template>
        <div v-else-if="effect.spec.effect === 'tiny_ghost'" class="ghost">👻</div>
        <div v-else-if="effect.spec.effect === 'peekaboo_cat'" class="cat">🐱</div>
        <template v-else-if="effect.spec.effect === 'sparkle_trail'">
          <span v-for="i in 16" :key="i" class="particle particle--burst" :style="particleStyle(effect, i, 90)">✨</span>
        </template>
      </template>

      <div v-else-if="effect.spec.type === 'sticker'" class="sticker" :class="{ 'sticker--calm': effect.reduced }" :style="{ ...effect.spec.sprite, left: `${15 + n(effect, 1) * 50}%`, top: `${20 + n(effect, 2) * 35}%` }" />

      <template v-else-if="effect.spec.type === 'hearts-synced'">
        <span v-for="i in 16" :key="i" class="particle particle--burst" :style="particleStyle(effect, i, 60)">💞</span>
        <div class="caption">Hearts synced</div>
      </template>

      <div v-else-if="effect.spec.type === 'note-card'" class="notecard">
        <p class="notecard__from">A note from {{ effect.spec.from }}</p>
        <p class="notecard__text">{{ effect.spec.text }}</p>
      </div>
    </template>
  </div>

  <button v-if="roomEffect.id" type="button" class="panic btn btn--danger" @click="stopRoomEffect">Stop the silliness</button>
</template>

<style scoped>
.fx { position: absolute; inset: 0; z-index: var(--layer-effects); pointer-events: none; overflow: hidden; }
.particle { position: absolute; bottom: 10%; font-size: calc(1.6rem * var(--s, 1)); animation-delay: var(--d); animation-fill-mode: both; text-shadow: 0 0 12px currentColor; }
.particle--float { animation: float-up 2.6s ease-out; }
.particle--burst { bottom: 50%; animation: burst-out 1.6s ease-out; }
.particle--rain { bottom: auto; top: -8%; animation: fall 3.4s linear; }
.pulse { position: absolute; left: 50%; top: 42%; font-size: 6rem; transform: translate(-50%, -50%); animation: pulse-pop 1.4s ease-out both; filter: drop-shadow(0 0 24px rgba(255, 122, 170, 0.8)); }
.glow { position: absolute; inset: 0; background: radial-gradient(circle at 50% 55%, color-mix(in srgb, var(--c) 45%, transparent), transparent 62%); animation: fade-glow 4s ease-out both; }
.confetti { position: absolute; top: -4%; width: 10px; height: 16px; border-radius: 2px; animation: fall 2.6s linear both; animation-delay: var(--d); }
.ghost { position: absolute; top: 30%; left: -10%; font-size: 4rem; animation: drift-across 4s linear both; opacity: 0.9; }
.cat { position: absolute; bottom: -4rem; right: 12%; font-size: 5rem; animation: peek 3.4s ease-in-out both; }
.caption { position: absolute; left: 50%; top: 24%; transform: translateX(-50%); padding: var(--space-2) var(--space-4); border-radius: var(--radius-pill); background: rgba(0, 0, 0, 0.55); font-weight: 800; animation: caption-in 2.8s ease-out both; }
.caption--spell { display: grid; gap: 2px; text-align: center; border: 1px solid var(--c); border-radius: var(--radius-md); max-width: 80vw; }
.caption--spell span { font-size: var(--text-sm); font-weight: 500; }
.sticker { position: absolute; width: 132px; height: 99px; border-radius: 12px; filter: drop-shadow(0 12px 20px rgba(0, 0, 0, 0.35)); animation: sticker-pop 2.7s ease both; }
.sticker--calm { animation: calm-fade 2.4s ease both; }
.calm { position: absolute; left: 50%; top: 18%; transform: translateX(-50%); padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); background: rgba(0, 0, 0, 0.6); border: 1px solid var(--line-gold); max-width: 86vw; text-align: center; animation: calm-fade 2.4s ease both; }
.notecard { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); width: min(420px, 88vw); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid rgba(255, 255, 255, 0.2); background: radial-gradient(circle at 15% 10%, rgba(255, 240, 187, 0.16), transparent 40%), rgba(20, 8, 30, 0.88); backdrop-filter: blur(10px); animation: caption-in 7s ease-out both; }
.notecard__from { margin: 0 0 var(--space-2); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-rose-soft); }
.notecard__text { margin: 0; font-family: var(--font-serif); font-size: var(--text-lg); line-height: 1.5; }
.panic { position: fixed; z-index: var(--layer-panic); left: 50%; top: calc(var(--safe-top) + var(--space-3)); transform: translateX(-50%); background: rgba(40, 0, 0, 0.9); pointer-events: auto; }

@keyframes float-up { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-70vh) translateX(var(--x)) scale(1.1); opacity: 0; } }
@keyframes burst-out { 0% { transform: translate(0, 0) scale(0.3); opacity: 1; } 100% { transform: translate(var(--x), var(--y)) scale(1.2); opacity: 0; } }
@keyframes fall { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(115vh) translateX(var(--x)) rotate(360deg); opacity: 0.9; } }
@keyframes pulse-pop { 0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; } 30% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; } 55% { transform: translate(-50%, -50%) scale(0.95); } 100% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; } }
@keyframes fade-glow { 0% { opacity: 0; } 25% { opacity: 1; } 100% { opacity: 0; } }
@keyframes drift-across { 0% { transform: translateX(0) translateY(0); } 50% { transform: translateX(60vw) translateY(-30px); } 100% { transform: translateX(120vw) translateY(10px); opacity: 0; } }
@keyframes peek { 0%, 100% { transform: translateY(0); } 25%, 70% { transform: translateY(-4.4rem); } }
@keyframes caption-in { 0% { opacity: 0; transform: translateX(-50%) translateY(10px); } 12% { opacity: 1; transform: translateX(-50%); } 85% { opacity: 1; } 100% { opacity: 0; } }
@keyframes sticker-pop { 0% { opacity: 0; transform: translateY(24px) scale(0.45) rotate(-12deg); } 16% { opacity: 1; transform: translateY(0) scale(1.06) rotate(6deg); } 30% { transform: scale(1) rotate(-3deg); } 78% { opacity: 1; transform: translateY(-12px) rotate(3deg); } 100% { opacity: 0; transform: translateY(-46px) scale(0.92) rotate(10deg); } }
@keyframes calm-fade { 0% { opacity: 0; } 15%, 80% { opacity: 1; } 100% { opacity: 0; } }
</style>
