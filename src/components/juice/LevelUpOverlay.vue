<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onJuice } from '../../juice/juiceBus'

interface LevelUpView {
  id: number
  level: number
  rank: string
}

const LEVEL_UP_DELAY_MS = 780
const LEVEL_UP_LIFETIME_MS = 3600

const view = ref<LevelUpView | null>(null)
let counter = 0
let unsubscribe: (() => void) | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined

function dismiss(): void {
  clearTimeout(hideTimer)
  view.value = null
}

onMounted(() => {
  // Wait for the XP bar to fill before taking over the screen.
  unsubscribe = onJuice((event) => {
    if (event.kind !== 'level-up') return
    setTimeout(() => {
      view.value = { id: ++counter, level: event.level, rank: event.rank }
      clearTimeout(hideTimer)
      hideTimer = setTimeout(dismiss, LEVEL_UP_LIFETIME_MS)
    }, LEVEL_UP_DELAY_MS)
  })
  window.addEventListener('keydown', dismiss)
})

onBeforeUnmount(() => {
  unsubscribe?.()
  clearTimeout(hideTimer)
  window.removeEventListener('keydown', dismiss)
})
</script>

<template>
  <Transition name="takeover">
    <div v-if="view" :key="view.id" class="takeover" @click="dismiss">
      <div class="rays" />
      <div class="ring ring-1" />
      <div class="ring ring-2" />
      <div class="ring ring-3" />
      <div class="level-up-core">
        <div class="kicker">&#9670; SYSTEM UPGRADE &#9670;</div>
        <div class="headline">LEVEL UP</div>
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
  background: radial-gradient(circle at center, rgba(25, 230, 255, 0.22), rgba(4, 5, 10, 0.92) 62%);
  backdrop-filter: blur(calc(6px * var(--fx-scale)));
}
.takeover-enter-active { animation: takeover-in 0.45s ease-out; }
.takeover-leave-active { transition: opacity 0.5s; }
.takeover-leave-to { opacity: 0; }
@keyframes takeover-in { from { opacity: 0; } to { opacity: 1; } }

.rays {
  position: absolute; width: 160vmax; height: 160vmax; opacity: calc(0.35 * var(--fx-scale));
  background: repeating-conic-gradient(from 0deg, rgba(57, 255, 136, 0.55) 0deg 6deg, transparent 6deg 18deg);
  mask-image: radial-gradient(circle, #000 0%, transparent 55%);
  -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 55%);
  animation: spin 14s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
:root[data-fx='off'] .rays { animation: none; }

.ring {
  position: absolute; width: 300px; height: 300px; border-radius: 50%;
  border: 4px solid var(--neon-cyan); box-shadow: var(--glow-cyan), inset var(--glow-cyan);
  opacity: 0; animation: ring-expand 1.8s ease-out infinite;
}
.ring-2 { animation-delay: 0.6s; border-color: var(--neon-violet); box-shadow: var(--glow-violet); }
.ring-3 { animation-delay: 1.2s; border-color: var(--neon-green); box-shadow: var(--glow-green); }
:root[data-fx='off'] .ring { display: none; }
@keyframes ring-expand {
  0% { opacity: 0.9; transform: scale(0.2); }
  100% { opacity: 0; transform: scale(calc(2.2 + 2 * var(--fx-scale))); }
}

.level-up-core { position: relative; text-align: center; }
.kicker { font-size: 13px; letter-spacing: 0.5em; color: var(--neon-green); text-shadow: var(--glow-green); animation: fade-rise 0.6s 0.1s both; }
.headline {
  font-family: var(--font-display); font-size: 74px; font-weight: 900; letter-spacing: 0.18em; color: #fff;
  text-shadow: var(--glow-cyan), 0 0 60px var(--neon-violet);
  animation: headline-slam 0.7s cubic-bezier(0.2, 1.5, 0.3, 1) 0.15s both;
}
.number {
  font-family: var(--font-display); font-size: 190px; line-height: 1; font-weight: 900;
  background: linear-gradient(180deg, #fff 0%, var(--neon-green) 45%, var(--neon-cyan) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 calc(24px * var(--fx-scale)) rgba(57, 255, 136, 0.8));
  animation: number-slam 0.9s cubic-bezier(0.15, 1.6, 0.3, 1) 0.4s both;
}
.rank { margin-top: 6px; font-family: var(--font-display); font-size: 22px; letter-spacing: 0.35em; text-transform: uppercase; color: var(--neon-amber); text-shadow: 0 0 18px var(--neon-amber); animation: fade-rise 0.6s 1s both; }
.hint { margin-top: 28px; font-size: 11px; letter-spacing: 0.3em; color: var(--text-dim); animation: fade-rise 0.6s 1.6s both; }

@keyframes fade-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes headline-slam {
  0% { opacity: 0; transform: scale(calc(1 + 3 * var(--fx-scale))); letter-spacing: 0.9em; }
  100% { opacity: 1; transform: scale(1); letter-spacing: 0.18em; }
}
@keyframes number-slam {
  0% { opacity: 0; transform: scale(calc(1 + 4 * var(--fx-scale))) rotate(calc(-12deg * var(--fx-scale))); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
</style>
