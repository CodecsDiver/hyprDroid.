import type {
  AchievementDefinition,
  ProgressionResult,
  ProgressionState,
  QuestDefinition,
  RealmEvent,
} from './types'
import { rankTitleForLevel } from './ranks'
import { levelForTotalXp } from './xpCurve'

/**
 * XP is only ever earned by finished, verified work: an objective whose tests pass, and the project
 * that completes. Saving, running and typing streaks never give XP (they unlock trophies), and the
 * Visualizer Lab is not connected to progression at all, so a level-up always means the code was actually correct.
 * Harder projects pay more.
 */
export const objectiveXp = (difficulty: number): number => 30 + 10 * difficulty
export const projectCompletionXp = (difficulty: number): number => 100 + 50 * difficulty

export const QUESTS: QuestDefinition[] = [
  { id: 'proof-of-work', title: 'Proof of Work', description: 'Verify 3 objectives.',
    targetCount: 3, rewardXp: 60, measureProgress: (state) => state.metObjectiveKeys.length },
  { id: 'project-zero', title: 'Project Zero', description: 'Complete your first project.',
    targetCount: 1, rewardXp: 80, measureProgress: (state) => state.completedProjectIds.length },
  { id: 'ten-for-ten', title: 'Ten for Ten', description: 'Verify 10 objectives.',
    targetCount: 10, rewardXp: 150, measureProgress: (state) => state.metObjectiveKeys.length },
  { id: 'hat-trick', title: 'Hat Trick', description: 'Complete 3 projects.',
    targetCount: 3, rewardXp: 250, measureProgress: (state) => state.completedProjectIds.length },
  { id: 'all-clear', title: 'All Clear', description: 'Complete all 5 projects.',
    targetCount: 5, rewardXp: 600, measureProgress: (state) => state.completedProjectIds.length },
]

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'first-spark', title: 'First Spark', description: 'Run your code for the first time.',
    isUnlocked: (state) => state.codeRunCount >= 1 },
  { id: 'commit-to-disk', title: 'Commit to Disk', description: 'Save your work 10 times.',
    isUnlocked: (state) => state.fileSaveCount >= 10 },
  { id: 'flow-state', title: 'Flow State', description: 'Reach a 40-keystroke combo.',
    isUnlocked: (state) => state.bestCombo >= 40 },
  { id: 'initiate', title: 'Initiate', description: 'Earn 100 XP.',
    isUnlocked: (state) => state.totalXp >= 100 },
  { id: 'adept', title: 'Adept', description: 'Earn 1,000 XP.',
    isUnlocked: (state) => state.totalXp >= 1000 },
  { id: 'persistent-signal', title: 'Persistent Signal', description: 'Save 50 times.',
    isUnlocked: (state) => state.fileSaveCount >= 50 },
  { id: 'trial-by-fire', title: 'Trial by Fire', description: 'Run code 25 times.',
    isUnlocked: (state) => state.codeRunCount >= 25 },
  { id: 'architect', title: 'Architect', description: 'Complete 3 projects.',
    isUnlocked: (state) => state.completedProjectIds.length >= 3 },
]

function baseXpAndState(state: ProgressionState, event: RealmEvent): { next: ProgressionState; xp: number } {
  switch (event.type) {
    case 'objective_met': {
      const key = `${event.projectId}/${event.objectiveId}`
      if (state.metObjectiveKeys.includes(key)) return { next: state, xp: 0 }
      return { next: { ...state, metObjectiveKeys: [...state.metObjectiveKeys, key] }, xp: objectiveXp(event.difficulty) }
    }
    case 'project_completed': {
      if (state.completedProjectIds.includes(event.projectId)) return { next: state, xp: 0 }
      return {
        next: { ...state, completedProjectIds: [...state.completedProjectIds, event.projectId] },
        xp: projectCompletionXp(event.difficulty),
      }
    }
    case 'file_saved':
      return { next: { ...state, fileSaveCount: state.fileSaveCount + 1 }, xp: 0 }
    case 'code_run':
      return { next: { ...state, codeRunCount: state.codeRunCount + 1 }, xp: 0 }
    case 'combo_peak':
      return { next: { ...state, bestCombo: Math.max(state.bestCombo, event.combo) }, xp: 0 }
  }
}

export function applyRealmEvent(
  state: ProgressionState,
  event: RealmEvent,
  quests: QuestDefinition[] = QUESTS,
  achievements: AchievementDefinition[] = ACHIEVEMENTS,
): ProgressionResult {
  const { next, xp } = baseXpAndState(state, event)
  let interim: ProgressionState = { ...next, totalXp: next.totalXp + xp }
  let gainedXp = xp

  const completedQuests: QuestDefinition[] = []
  for (const quest of quests) {
    if (interim.completedQuestIds.includes(quest.id)) continue
    if (quest.measureProgress(interim) < quest.targetCount) continue
    completedQuests.push(quest)
    gainedXp += quest.rewardXp
    interim = {
      ...interim,
      totalXp: interim.totalXp + quest.rewardXp,
      completedQuestIds: [...interim.completedQuestIds, quest.id],
    }
  }

  const unlockedAchievements = achievements.filter(
    (achievement) => !interim.unlockedAchievementIds.includes(achievement.id) && achievement.isUnlocked(interim),
  )
  if (unlockedAchievements.length > 0) {
    interim = {
      ...interim,
      unlockedAchievementIds: [...interim.unlockedAchievementIds, ...unlockedAchievements.map((a) => a.id)],
    }
  }

  const levelBefore = levelForTotalXp(state.totalXp)
  const levelAfter = levelForTotalXp(interim.totalXp)
  const reachedNewRank = levelAfter > levelBefore && rankTitleForLevel(levelAfter) !== rankTitleForLevel(levelBefore)
  return {
    state: interim,
    gainedXp,
    completedQuests,
    unlockedAchievements,
    reachedLevel: levelAfter > levelBefore ? levelAfter : null,
    reachedNewRank,
  }
}
