<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { describeLevelUp } from '../../gamification/levelUpTier'
import { onJuice, type JuiceEvent } from '../../juice/juiceBus'
import {
  createParticleField,
  HUE_AMBER,
  HUE_CYAN,
  HUE_GREEN,
  HUE_VIOLET,
  type ParticleField,
} from '../../juice/particleField'
import { shakeScreen } from '../../juice/screenShake'
import { useSettingsStore } from '../../stores/settingsStore'

const settings = useSettingsStore()
const canvas = ref<HTMLCanvasElement>()
const flash = ref<{ id: number; color: string } | null>(null)
let field: ParticleField | undefined
let unsubscribe: (() => void) | undefined
let flashCounter = 0
const pendingTimers = new Set<ReturnType<typeof setTimeout>>()

const later = (delayMs: number, action: () => void) => {
  const timer = setTimeout(() => {
    pendingTimers.delete(timer)
    action()
  }, delayMs)
  pendingTimers.add(timer)
}

function centerOf(selector: string): { x: number; y: number } {
  const element = document.querySelector(selector)
  if (!element) return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  const bounds = element.getBoundingClientRect()
  return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
}

function shake(amplitude: number, durationMs = 380): void {
  if (settings.screenShakeEnabled) shakeScreen(amplitude * settings.fxScale(), durationMs)
}

function flashScreen(color: string): void {
  if (settings.fxScale() <= 0) return
  flash.value = { id: ++flashCounter, color }
}

function fireworks(rounds: number, hues: number[] = [HUE_GREEN, HUE_CYAN, HUE_VIOLET, HUE_AMBER], particleScale = 1): void {
  for (let round = 0; round < rounds; round++) {
    later(round * 260, () => {
      const x = window.innerWidth * (0.15 + Math.random() * 0.7)
      const y = window.innerHeight * (0.15 + Math.random() * 0.45)
      field?.burst(x, y, { count: Math.round(90 * particleScale), hues, speed: 520, size: 4 })
      field?.ring(x, y, hues[round % hues.length], 160)
    })
  }
}

function handle(event: JuiceEvent): void {
  if (!field) return
  switch (event.kind) {
    case 'keystroke': {
      const tier = event.combo >= 50 ? [HUE_AMBER, HUE_VIOLET] : event.combo >= 25 ? [HUE_VIOLET, HUE_CYAN] : event.combo >= 10 ? [HUE_CYAN, HUE_GREEN] : [HUE_GREEN]
      field.burst(event.x, event.y, { count: 3 + Math.floor(event.combo / 8), hues: tier, speed: 190, spread: Math.PI * 1.1, upwardBias: 90, size: 2.6 })
      break
    }
    case 'combo-milestone': {
      const { x, y } = centerOf('.combo')
      field.burst(x, y, { count: 55, hues: [HUE_CYAN, HUE_VIOLET, HUE_GREEN], speed: 420, size: 3.4 })
      field.ring(x, y, HUE_CYAN, 120)
      shake(3 + Math.min(event.combo / 20, 4), 300)
      break
    }
    case 'combo-broken': {
      const { x, y } = centerOf('.combo')
      field.burst(x, y, { count: 18, hues: [350], speed: 200, size: 2.6, upwardBias: -40 })
      break
    }
    case 'saved': {
      const { x, y } = centerOf('.save-state')
      field.burst(x, y, { count: 36, hues: [HUE_GREEN, HUE_CYAN], speed: 300, spread: Math.PI * 1.4, upwardBias: 100, size: 3 })
      field.ring(x, y, HUE_GREEN, 90)
      break
    }
    case 'objective-met': {
      const { x, y } = centerOf('.objectives')
      field.burst(x, y, { count: 120, hues: [HUE_GREEN, HUE_CYAN], speed: 560, size: 4 })
      field.ring(x, y, HUE_GREEN, 220)
      later(120, () => field?.ring(x, y, HUE_CYAN, 300))
      flashScreen('rgb(var(--neon-green-rgb) / 0.18)')
      shake(8, 420)
      break
    }
    case 'objective-failed':
      flashScreen('rgb(var(--neon-red-rgb) / 0.2)')
      shake(5, 320)
      break
    case 'quest-completed': {
      field.burst(window.innerWidth - 200, 140, { count: 70, hues: [HUE_VIOLET, HUE_AMBER], speed: 440, size: 3.6 })
      field.ring(window.innerWidth - 200, 140, HUE_VIOLET, 200)
      break
    }
    case 'achievement-unlocked': {
      field.burst(window.innerWidth - 200, 200, { count: 80, hues: [HUE_AMBER, HUE_AMBER, HUE_GREEN], speed: 460, size: 3.8 })
      shake(5, 360)
      break
    }
    case 'level-up': {
      const style = describeLevelUp(event.level, event.rankChanged)
      later(780, () => {
        flashScreen('rgba(255, 255, 255, 0.55)')
        shake(16 * style.shakeScale, 600 + style.ringCount * 60)
        const { x, y } = centerOf('.level-up-core')
        field?.burst(x, y, { count: Math.round(220 * style.particleScale), hues: style.hues, speed: 760, size: 5 })
        for (let ring = 0; ring < style.ringCount; ring++) {
          later(ring * 180, () => field?.ring(x, y, style.hues[ring % style.hues.length], 420 + ring * 90))
        }
        fireworks(style.fireworkRounds, style.hues, style.particleScale)
      })
      break
    }
    case 'project-completed':
      flashScreen('rgb(var(--neon-violet-rgb) / 0.28)')
      shake(12, 600)
      fireworks(8)
      break
    case 'run-started':
    case 'xp-gained':
      break
  }
}

function handleResize(): void {
  field?.resize()
}

onMounted(() => {
  field = createParticleField(canvas.value!, () => settings.fxScale())
  unsubscribe = onJuice(handle)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  unsubscribe?.()
  field?.stop()
  pendingTimers.forEach(clearTimeout)
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="flash" v-if="flash" :key="flash.id" :style="{ background: flash.color }" @animationend="flash = null" />
  <canvas ref="canvas" class="particles" />
</template>

<style scoped>
.particles {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 90;
  pointer-events: none;
}
.flash {
  position: fixed;
  inset: 0;
  z-index: 89;
  pointer-events: none;
  animation: flash-out 0.55s ease-out forwards;
}
@keyframes flash-out { from { opacity: 1; } to { opacity: 0; } }
</style>
