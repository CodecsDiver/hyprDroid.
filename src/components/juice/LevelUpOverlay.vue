<script setup lang="ts">
import { themedHue } from '../../theme/applyTheme'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { describeLevelUp } from '../../gamification/levelUpTier'
import { onJuice } from '../../juice/juiceBus'

interface LevelUpView {
  id: number
  level: number
  rank: string
  rankChanged: boolean
}

const LEVEL_UP_DELAY_MS = 780

const view = ref<LevelUpView | null>(null)
const style = computed(() => (view.value ? describeLevelUp(view.value.level, view.value.rankChanged) : null))
let counter = 0
let unsubscribe: (() => void) | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined
const pendingTimers = new Set<ReturnType<typeof setTimeout>>()

const hsl = (hue: number, lightness = 60) => `hsl(${themedHue(hue)} 100% ${lightness}%)`
const colourVariables = computed(() => {
  const hues = style.value?.hues ?? [145, 188]
  return {
    '--lv-a': hsl(hues[0]),
    '--lv-b': hsl(hues[1 % hues.length]),
    '--lv-c': hsl(hues[2 % hues.length]),
    '--lv-glow-a': `hsl(${themedHue(hues[0])} 100% 60% / 0.8)`,
  }
})

function dismiss(): void {
  clearTimeout(hideTimer)
  view.value = null
}

onMounted(() => {
  // Wait for the XP bar to fill before taking over the screen.
  unsubscribe = onJuice((event) => {
    if (event.kind !== 'level-up') return
    const timer = setTimeout(() => {
      pendingTimers.delete(timer)
      view.value = { id: ++counter, level: event.level, rank: event.rank, rankChanged: event.rankChanged }
      clearTimeout(hideTimer)
      hideTimer = setTimeout(dismiss, describeLevelUp(event.level, event.rankChanged).lifetimeMs)
    }, LEVEL_UP_DELAY_MS)
    pendingTimers.add(timer)
  })
  window.addEventListener('keydown', dismiss)
})

onBeforeUnmount(() => {
  unsubscribe?.()
  clearTimeout(hideTimer)
  pendingTimers.forEach(clearTimeout)
  window.removeEventListener('keydown', dismiss)
})
</script>

<template>
  <Transition name="takeover">
    <div v-if="view && style" :key="view.id" class="takeover" :class="`tier-${style.tier}`" :style="colourVariables" @click="dismiss">
      <div class="rays" />
      <div v-for="ring in style.ringCount" :key="ring" class="ring" :style="{ animationDelay: `${(ring - 1) * 0.45}s`, borderColor: ring % 2 ? 'var(--lv-a)' : 'var(--lv-b)' }" />
      <div class="level-up-core">
        <div class="kicker">&#9670; {{ style.kicker }} &#9670;</div>
        <div class="headline">{{ style.headline }}</div>
        <div class="number">{{ view.level }}</div>
        <div class="rank">{{ view.rank }}</div>
        <div class="hint">press any key</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.takeover {
  position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; overflow: hidden;
  background: radial-gradient(circle at center, var(--lv-glow-a), rgb(var(--void-rgb) / 0.92) 62%);
  backdrop-filter: blur(calc(6px * var(--fx-scale)));
}
.takeover-enter-active { animation: takeover-in 0.45s ease-out; }
.takeover-leave-active { transition: opacity 0.5s; }
.takeover-leave-to { opacity: 0; }
@keyframes takeover-in { from { opacity: 0; } to { opacity: 1; } }

.rays {
  position: absolute; width: 160vmax; height: 160vmax; opacity: calc(0.35 * var(--fx-scale));
  background: repeating-conic-gradient(from 0deg, var(--lv-a) 0deg 6deg, transparent 6deg 18deg);
  mask-image: radial-gradient(circle, #000 0%, transparent 55%);
  -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 55%);
  animation: spin 14s linear infinite;
}
.tier-major .rays, .tier-rank .rays { background: repeating-conic-gradient(from 0deg, var(--lv-a) 0deg 5deg, var(--lv-b) 5deg 10deg, transparent 10deg 18deg); }
.tier-milestone .rays, .tier-legend .rays { background: repeating-conic-gradient(from 0deg, var(--lv-a) 0deg 4deg, var(--lv-b) 4deg 8deg, var(--lv-c) 8deg 12deg, transparent 12deg 16deg); animation-duration: 7s; }
@keyframes spin { to { transform: rotate(360deg); } }
:root[data-fx='off'] .rays { animation: none; }

.ring {
  position: absolute; width: 300px; height: 300px; border-radius: 50%; border: 4px solid var(--lv-a);
  box-shadow: 0 0 calc(14px * var(--fx-scale)) var(--lv-a); opacity: 0; animation: ring-expand 2.2s ease-out infinite;
}
:root[data-fx='off'] .ring { display: none; }
@keyframes ring-expand {
  0% { opacity: 0.9; transform: scale(0.2); }
  100% { opacity: 0; transform: scale(calc(2.2 + 2 * var(--fx-scale))); }
}

.level-up-core { position: relative; text-align: center; }
.kicker { font-size: 13px; letter-spacing: 0.5em; color: var(--lv-a); text-shadow: 0 0 12px var(--lv-a); animation: fade-rise 0.6s 0.1s both; }
.headline {
  font-family: var(--font-display); font-size: 74px; font-weight: 900; letter-spacing: 0.18em; color: var(--flash);
  text-shadow: 0 0 20px var(--lv-b), 0 0 60px var(--lv-c);
  animation: headline-slam 0.7s cubic-bezier(0.2, 1.5, 0.3, 1) 0.15s both;
}
.tier-rank .headline, .tier-milestone .headline { font-size: 88px; }
.tier-legend .headline { font-size: 96px; animation-name: headline-slam, legend-pulse; animation-duration: 0.7s, 1.4s; animation-delay: 0.15s, 0.9s; animation-iteration-count: 1, infinite; }
.number {
  font-family: var(--font-display); font-size: 190px; line-height: 1; font-weight: 900;
  background: linear-gradient(180deg, var(--flash) 0%, var(--lv-a) 45%, var(--lv-b) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 calc(24px * var(--fx-scale)) var(--lv-a));
  animation: number-slam 0.9s cubic-bezier(0.15, 1.6, 0.3, 1) 0.4s both;
}
.tier-milestone .number, .tier-legend .number { font-size: 230px; }
.rank { margin-top: 6px; font-family: var(--font-display); font-size: 22px; letter-spacing: 0.35em; text-transform: uppercase; color: var(--lv-c); text-shadow: 0 0 18px var(--lv-c); animation: fade-rise 0.6s 1s both; }
.hint { margin-top: 28px; font-size: 11px; letter-spacing: 0.3em; color: var(--text-dim); animation: fade-rise 0.6s 1.6s both; }

@keyframes fade-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes headline-slam {
  0% { opacity: 0; transform: scale(calc(1 + 3 * var(--fx-scale))); letter-spacing: 0.9em; }
  100% { opacity: 1; transform: scale(1); letter-spacing: 0.18em; }
}
@keyframes legend-pulse { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.6); } }
@keyframes number-slam {
  0% { opacity: 0; transform: scale(calc(1 + 4 * var(--fx-scale))) rotate(calc(-12deg * var(--fx-scale))); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
</style>
