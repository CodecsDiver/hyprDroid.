import { describe, expect, it } from 'vitest'
import { applyRealmEvent, XP_REWARDS } from './progressionEngine'
import { createEmptyProgression } from './types'
import { describeLevelProgress, levelForTotalXp, totalXpRequiredForLevel } from './xpCurve'

const objectiveEvent = (objectiveId: string) =>
  ({ type: 'objective_met', projectId: 'p1', objectiveId }) as const

describe('applyRealmEvent', () => {
  it('awards objective XP exactly once per objective', () => {
    const first = applyRealmEvent(createEmptyProgression(), objectiveEvent('a'))
    expect(first.state.totalXp).toBe(XP_REWARDS.objectiveMet)
    const repeated = applyRealmEvent(first.state, objectiveEvent('a'))
    expect(repeated.gainedXp).toBe(0)
    expect(repeated.state.totalXp).toBe(first.state.totalXp)
  })

  it('does not mutate its input', () => {
    const state = createEmptyProgression()
    const snapshot = JSON.stringify(state)
    applyRealmEvent(state, { type: 'file_saved' })
    expect(JSON.stringify(state)).toBe(snapshot)
  })

  it('completes a quest once and adds its reward to the gained XP', () => {
    const first = applyRealmEvent(createEmptyProgression(), { type: 'code_run' })
    expect(first.completedQuests.map((quest) => quest.id)).toEqual(['first-spark'])
    expect(first.gainedXp).toBe(XP_REWARDS.codeRun + 20)
    const second = applyRealmEvent(first.state, { type: 'code_run' })
    expect(second.completedQuests).toEqual([])
  })

  it('reports level-ups across repeated events and keeps climbing past level 1', () => {
    let state = createEmptyProgression()
    const reached: number[] = []
    for (let step = 0; step < 40; step++) {
      const result = applyRealmEvent(state, objectiveEvent(`objective-${step}`))
      if (result.reachedLevel) reached.push(result.reachedLevel)
      state = result.state
    }
    expect(reached[0]).toBe(2)
    expect(reached.length).toBeGreaterThan(3)
    expect(reached).toEqual([...reached].sort((a, b) => a - b))
  })

  it('tracks the best combo and unlocks achievements', () => {
    const peak = applyRealmEvent(createEmptyProgression(), { type: 'combo_peak', combo: 41 })
    expect(peak.state.bestCombo).toBe(41)
    expect(peak.completedQuests.map((quest) => quest.id)).toContain('flow-state')
    const rich = applyRealmEvent({ ...createEmptyProgression(), totalXp: 99 }, { type: 'file_saved' })
    expect(rich.unlockedAchievements.map((a) => a.id)).toContain('initiate')
  })
})

describe('xpCurve', () => {
  it('has strictly increasing level thresholds', () => {
    for (let level = 1; level < 60; level++) {
      expect(totalXpRequiredForLevel(level + 1)).toBeGreaterThan(totalXpRequiredForLevel(level))
    }
  })

  it('derives level and in-level fraction from total XP alone, at every level', () => {
    for (const totalXp of [0, 50, 99, 100, 101, 330, 1000, 5000, 40000]) {
      const progress = describeLevelProgress(totalXp)
      expect(progress.level).toBe(levelForTotalXp(totalXp))
      expect(progress.fraction).toBeGreaterThanOrEqual(0)
      expect(progress.fraction).toBeLessThan(1)
      expect(totalXpRequiredForLevel(progress.level) + progress.xpIntoLevel).toBe(totalXp)
    }
  })

  it('moves off level 1 at exactly 100 XP', () => {
    expect(levelForTotalXp(99)).toBe(1)
    expect(levelForTotalXp(100)).toBe(2)
  })
})
