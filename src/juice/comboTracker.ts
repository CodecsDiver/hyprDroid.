export interface ComboTracker {
  registerKeystroke(nowMs: number): number
  currentCombo(nowMs: number): number
  reset(): void
}

export function createComboTracker(decayWindowMs = 1800): ComboTracker {
  let combo = 0
  let lastKeystrokeMs = -Infinity
  return {
    registerKeystroke(nowMs) {
      combo = nowMs - lastKeystrokeMs <= decayWindowMs ? combo + 1 : 1
      lastKeystrokeMs = nowMs
      return combo
    },
    currentCombo(nowMs) {
      return nowMs - lastKeystrokeMs <= decayWindowMs ? combo : 0
    },
    reset() {
      combo = 0
      lastKeystrokeMs = -Infinity
    },
  }
}

export function comboMultiplier(combo: number): number {
  if (combo >= 100) return 5
  if (combo >= 50) return 4
  if (combo >= 25) return 3
  if (combo >= 10) return 2
  return 1
}
