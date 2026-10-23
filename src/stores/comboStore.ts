import { defineStore } from 'pinia'
import { ref } from 'vue'
import { comboMultiplier, createComboTracker } from '../juice/comboTracker'
import { emitJuice } from '../juice/juiceBus'
import { useProgressionStore } from './progressionStore'

const COMBO_MILESTONE_STEP = 10
const COMBO_DECAY_MS = 1800

export const useComboStore = defineStore('combo', () => {
  const combo = ref(0)
  const multiplier = ref(1)
  const decayProgress = ref(0)
  const tracker = createComboTracker(COMBO_DECAY_MS)
  let decayTimer: ReturnType<typeof setTimeout> | undefined
  let animationFrame = 0
  let lastKeystrokeAt = 0

  function tickDecayBar(): void {
    const elapsed = performance.now() - lastKeystrokeAt
    decayProgress.value = Math.max(0, 1 - elapsed / COMBO_DECAY_MS)
    if (decayProgress.value > 0) animationFrame = requestAnimationFrame(tickDecayBar)
  }

  function breakCombo(): void {
    if (combo.value >= 5) emitJuice({ kind: 'combo-broken', combo: combo.value })
    combo.value = 0
    multiplier.value = 1
    decayProgress.value = 0
    tracker.reset()
  }

  function registerKeystroke(): number {
    const now = performance.now()
    lastKeystrokeAt = now
    combo.value = tracker.registerKeystroke(now)
    multiplier.value = comboMultiplier(combo.value)

    clearTimeout(decayTimer)
    decayTimer = setTimeout(breakCombo, COMBO_DECAY_MS)
    cancelAnimationFrame(animationFrame)
    animationFrame = requestAnimationFrame(tickDecayBar)

    if (combo.value >= COMBO_MILESTONE_STEP && combo.value % COMBO_MILESTONE_STEP === 0) {
      emitJuice({ kind: 'combo-milestone', combo: combo.value })
      useProgressionStore().record({ type: 'combo_peak', combo: combo.value })
    }
    return combo.value
  }

  return { combo, multiplier, decayProgress, registerKeystroke }
})
