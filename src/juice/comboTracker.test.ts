import { describe, expect, it } from 'vitest'
import { comboMultiplier, createComboTracker } from './comboTracker'

describe('comboTracker', () => {
  it('builds while keystrokes arrive inside the window and restarts after a pause', () => {
    const tracker = createComboTracker(1000)
    expect(tracker.registerKeystroke(0)).toBe(1)
    expect(tracker.registerKeystroke(400)).toBe(2)
    expect(tracker.registerKeystroke(1300)).toBe(3)
    expect(tracker.registerKeystroke(3000)).toBe(1)
  })

  it('reports zero once the combo has decayed', () => {
    const tracker = createComboTracker(1000)
    tracker.registerKeystroke(0)
    expect(tracker.currentCombo(900)).toBe(1)
    expect(tracker.currentCombo(1200)).toBe(0)
  })

  it('maps combo size to a multiplier tier', () => {
    expect([0, 9, 10, 25, 50, 100].map(comboMultiplier)).toEqual([1, 1, 2, 3, 4, 5])
  })
})
