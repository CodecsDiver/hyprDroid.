import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { loadDocument, saveDocument } from '../backend/backend'
import { applyRealmEvent } from '../gamification/progressionEngine'
import { rankTitleForLevel } from '../gamification/ranks'
import { createEmptyProgression, type ProgressionResult, type ProgressionState, type RealmEvent } from '../gamification/types'
import { describeLevelProgress } from '../gamification/xpCurve'
import { emitJuice } from '../juice/juiceBus'

export const useProgressionStore = defineStore('progression', () => {
  const state = ref<ProgressionState>(createEmptyProgression())
  const saveError = ref<string | null>(null)
  let pendingSave: Promise<void> = Promise.resolve()

  const levelProgress = computed(() => describeLevelProgress(state.value.totalXp))
  const rankTitle = computed(() => rankTitleForLevel(levelProgress.value.level))

  async function load(): Promise<void> {
    try {
      const stored = await loadDocument<Partial<ProgressionState>>('progression')
      if (stored && stored.schemaVersion === 1) {
        state.value = { ...createEmptyProgression(), ...stored }
      }
    } catch (error) {
      console.warn('progression could not be loaded, starting fresh', error)
    }
  }

  /** Writes are chained so two quick events can never persist out of order. */
  function persist(snapshot: ProgressionState): void {
    pendingSave = pendingSave
      .then(() => saveDocument('progression', snapshot))
      .then(() => {
        saveError.value = null
      })
      .catch((error) => {
        saveError.value = error?.message ?? String(error)
      })
  }

  function announce(result: ProgressionResult): void {
    if (result.gainedXp > 0) emitJuice({ kind: 'xp-gained', amount: result.gainedXp })
    for (const quest of result.completedQuests) {
      emitJuice({ kind: 'quest-completed', title: quest.title, rewardXp: quest.rewardXp })
    }
    for (const achievement of result.unlockedAchievements) {
      emitJuice({ kind: 'achievement-unlocked', title: achievement.title })
    }
    if (result.reachedLevel !== null) {
      emitJuice({
        kind: 'level-up',
        level: result.reachedLevel,
        rank: rankTitleForLevel(result.reachedLevel),
        rankChanged: result.reachedNewRank,
      })
    }
  }

  function record(event: RealmEvent): ProgressionResult {
    const result = applyRealmEvent(state.value, event)
    state.value = result.state
    if (result.gainedXp > 0 || result.completedQuests.length > 0 || result.unlockedAchievements.length > 0 || event.type !== 'combo_peak') {
      persist(result.state)
    }
    announce(result)
    return result
  }

  function hasMetObjective(projectId: string, objectiveId: string): boolean {
    return state.value.metObjectiveKeys.includes(`${projectId}/${objectiveId}`)
  }

  function hasCompletedProject(projectId: string): boolean {
    return state.value.completedProjectIds.includes(projectId)
  }

  return { state, saveError, levelProgress, rankTitle, load, record, hasMetObjective, hasCompletedProject }
})
