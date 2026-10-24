<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onJuice, type JuiceEvent } from '../../juice/juiceBus'

type BannerTone = 'green' | 'violet' | 'amber' | 'red' | 'cyan'

interface Banner {
  id: number
  tone: BannerTone
  headline: string
  detail: string
}

interface XpFloater {
  id: number
  amount: number
}

const banners = ref<Banner[]>([])
const floaters = ref<XpFloater[]>([])
const comboCallout = ref<{ id: number; combo: number } | null>(null)
let counter = 0
let unsubscribe: (() => void) | undefined

function addBanner(tone: BannerTone, headline: string, detail: string, lifetimeMs = 3400): void {
  const id = ++counter
  banners.value = [...banners.value.slice(-3), { id, tone, headline, detail }]
  setTimeout(() => {
    banners.value = banners.value.filter((banner) => banner.id !== id)
  }, lifetimeMs)
}

function handle(event: JuiceEvent): void {
  switch (event.kind) {
    case 'saved':
      addBanner('cyan', 'SAVED', 'main.py written to disk', 1500)
      break
    case 'objective-met':
      addBanner('green', 'OBJECTIVE VERIFIED', event.title)
      break
    case 'objective-failed':
      addBanner('red', 'NOT YET', 'Read the red message, fix it, check again', 2600)
      break
    case 'quest-completed':
      addBanner('violet', 'QUEST COMPLETE', `${event.title}  +${event.rewardXp} XP`, 4200)
      break
    case 'achievement-unlocked':
      addBanner('amber', 'TROPHY UNLOCKED', event.title, 4600)
      break
    case 'project-completed':
      addBanner('violet', 'PROJECT CLEARED', event.title, 5200)
      break
    case 'banner':
      addBanner(event.tone, event.headline, event.detail, 4200)
      break
    case 'xp-gained': {
      const id = ++counter
      floaters.value = [...floaters.value, { id, amount: event.amount }]
      setTimeout(() => {
        floaters.value = floaters.value.filter((floater) => floater.id !== id)
      }, 1400)
      break
    }
    case 'combo-milestone': {
      const id = ++counter
      comboCallout.value = { id, combo: event.combo }
      setTimeout(() => {
        if (comboCallout.value?.id === id) comboCallout.value = null
      }, 900)
      break
    }
    default:
      break
  }
}

onMounted(() => {
  unsubscribe = onJuice(handle)
})
onBeforeUnmount(() => unsubscribe?.())
</script>

<template>
  <div class="banner-layer">
    <TransitionGroup name="banner" tag="div" class="banner-stack">
      <div v-for="banner in banners" :key="banner.id" class="banner" :class="`tone-${banner.tone}`">
        <div class="banner-headline">{{ banner.headline }}</div>
        <div class="banner-detail">{{ banner.detail }}</div>
      </div>
    </TransitionGroup>

    <div class="floater-anchor">
      <div v-for="floater in floaters" :key="floater.id" class="floater">+{{ floater.amount }} XP</div>
    </div>

    <div v-if="comboCallout" :key="comboCallout.id" class="combo-callout">{{ comboCallout.combo }} COMBO!</div>
  </div>
</template>

<style scoped>
.banner-layer { position: fixed; inset: 0; z-index: 85; pointer-events: none; }
.banner-stack { position: absolute; top: 150px; right: 22px; display: flex; flex-direction: column; gap: 10px; align-items: flex-end; }
.banner {
  min-width: 300px; max-width: 380px; padding: 12px 22px 12px 18px;
  background: rgb(var(--void-rgb) / 0.92);
  border-right: 5px solid var(--tone);
  box-shadow: 0 0 calc(30px * var(--fx-scale)) -4px var(--tone), inset 0 0 40px -20px var(--tone);
  clip-path: polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px);
}
.banner-headline { font-family: var(--font-display); font-size: 15px; font-weight: 900; letter-spacing: 0.22em; color: var(--tone); text-shadow: 0 0 12px var(--tone); }
.banner-detail { margin-top: 3px; font-size: 12px; color: var(--text); }
.tone-green { --tone: var(--neon-green); }
.tone-violet { --tone: var(--neon-violet); }
.tone-amber { --tone: var(--neon-amber); }
.tone-red { --tone: var(--neon-red); }
.tone-cyan { --tone: var(--neon-cyan); }

.banner-enter-active { animation: banner-slam 0.5s cubic-bezier(0.2, 1.3, 0.3, 1); }
.banner-leave-active { transition: opacity 0.4s, transform 0.4s; position: absolute; }
.banner-leave-to { opacity: 0; transform: translateX(60px); }
.banner-move { transition: transform 0.35s; }
@keyframes banner-slam {
  0% { opacity: 0; transform: translateX(calc(120px * max(var(--fx-scale), 0.2))) scale(calc(1 + 0.25 * var(--fx-scale))); filter: brightness(2.5); }
  100% { opacity: 1; transform: translateX(0) scale(1); filter: brightness(1); }
}

.floater-anchor { position: absolute; top: 120px; left: 50%; }
.floater {
  position: absolute; left: 0; transform: translateX(-50%);
  font-family: var(--font-display); font-size: 26px; font-weight: 900; white-space: nowrap;
  color: var(--neon-green); text-shadow: var(--glow-green), 0 2px 0 #000;
  animation: float-up 1.3s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
}
@keyframes float-up {
  0% { opacity: 0; transform: translate(-50%, 10px) scale(0.6); }
  15% { opacity: 1; transform: translate(-50%, 0) scale(calc(1 + 0.4 * var(--fx-scale))); }
  100% { opacity: 0; transform: translate(-50%, -80px) scale(1); }
}

.combo-callout {
  position: absolute; top: 34%; left: 50%;
  font-family: var(--font-display); font-size: 54px; font-weight: 900; letter-spacing: 0.1em; white-space: nowrap;
  color: var(--flash); text-shadow: var(--glow-cyan), 0 0 40px var(--neon-violet);
  animation: callout 0.9s cubic-bezier(0.2, 1.4, 0.3, 1) forwards;
}
@keyframes callout {
  0% { opacity: 0; transform: translate(-50%, 0) scale(calc(2.4 * max(var(--fx-scale), 0.4))); }
  25% { opacity: 1; transform: translate(-50%, 0) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -40px) scale(1.1); }
}
</style>
