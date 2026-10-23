import { describe, expect, it } from 'vitest'
import { applyRealmEvent, objectiveXp, projectCompletionXp } from './progressionEngine'
import { createEmptyProgression } from './types'
import { describeLevelProgress, levelForTotalXp, totalXpRequiredForLevel } from './xpCurve'

const objectiveEvent = (objectiveId: string, difficulty = 1) =>
  ({ type: 'objective_met', projectId: 'p1', objectiveId, difficulty }) as const

describe('XP only comes from verified work', () => {
  it('gives no XP for saving, running or typing streaks, however often', () => {
    let state = createEmptyProgression()
    for (let count = 0; count < 200; count++) {
      state = applyRealmEvent(state, { type: 'file_saved' }).state
      state = applyRealmEvent(state, { type: 'code_run' }).state
      state = applyRealmEvent(state, { type: 'combo_peak', combo: 10 + count }).state
    }
    expect(state.totalXp).toBe(0)
    expect(levelForTotalXp(state.totalXp)).toBe(1)
    expect(state.fileSaveCount).toBe(200)
  })

  it('never reports a level-up or quest XP for unverified activity', () => {
    const result = applyRealmEvent(createEmptyProgression(), { type: 'combo_peak', combo: 500 })
    expect(result.reachedLevel).toBeNull()
    expect(result.gainedXp).toBe(0)
    expect(result.completedQuests).toEqual([])
  })

  it('awards objective XP exactly once per objective', () => {
    const first = applyRealmEvent(createEmptyProgression(), objectiveEvent('a'))
    expect(first.state.totalXp).toBe(objectiveXp(1))
    const repeated = applyRealmEvent(first.state, objectiveEvent('a'))
    expect(repeated.gainedXp).toBe(0)
    expect(repeated.state.totalXp).toBe(first.state.totalXp)
  })

  it('pays more for harder projects', () => {
    expect(objectiveXp(5)).toBeGreaterThan(objectiveXp(1))
    expect(projectCompletionXp(5)).toBeGreaterThan(projectCompletionXp(1))
    const easy = applyRealmEvent(createEmptyProgression(), objectiveEvent('a', 1))
    const hard = applyRealmEvent(createEmptyProgression(), objectiveEvent('a', 5))
    expect(hard.gainedXp).toBeGreaterThan(easy.gainedXp)
  })

  it('awards project completion once', () => {
    const first = applyRealmEvent(createEmptyProgression(), { type: 'project_completed', projectId: 'p1', difficulty: 2 })
    expect(first.state.totalXp).toBeGreaterThanOrEqual(projectCompletionXp(2))
    const second = applyRealmEvent(first.state, { type: 'project_completed', projectId: 'p1', difficulty: 2 })
    expect(second.gainedXp).toBe(0)
  })
})

describe('applyRealmEvent', () => {
  it('does not mutate its input', () => {
    const state = createEmptyProgression()
    const snapshot = JSON.stringify(state)
    applyRealmEvent(state, objectiveEvent('a'))
    expect(JSON.stringify(state)).toBe(snapshot)
  })

  it('completes a quest once and adds its reward to the gained XP', () => {
    let state = createEmptyProgression()
    state = applyRealmEvent(state, objectiveEvent('a')).state
    state = applyRealmEvent(state, objectiveEvent('b')).state
    const third = applyRealmEvent(state, objectiveEvent('c'))
    expect(third.completedQuests.map((quest) => quest.id)).toEqual(['proof-of-work'])
    expect(third.gainedXp).toBe(objectiveXp(1) + 60)
    const fourth = applyRealmEvent(third.state, objectiveEvent('d'))
    expect(fourth.completedQuests).toEqual([])
  })

  it('reports level-ups in order, keeps climbing past level 1, and flags rank changes', () => {
    let state = createEmptyProgression()
    const reached: number[] = []
    let sawRankChange = false
    for (let step = 0; step < 60; step++) {
      const result = applyRealmEvent(state, objectiveEvent(`objective-${step}`, 3))
      if (result.reachedLevel) reached.push(result.reachedLevel)
      sawRankChange ||= result.reachedNewRank
      state = result.state
    }
    expect(reached[0]).toBe(2)
    expect(reached.length).toBeGreaterThan(4)
    expect(reached).toEqual([...reached].sort((a, b) => a - b))
    expect(sawRankChange).toBe(true)
  })

  it('unlocks activity trophies without paying XP', () => {
    const peak = applyRealmEvent(createEmptyProgression(), { type: 'combo_peak', combo: 41 })
    expect(peak.state.bestCombo).toBe(41)
    expect(peak.unlockedAchievements.map((a) => a.id)).toContain('flow-state')
    expect(peak.gainedXp).toBe(0)
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
