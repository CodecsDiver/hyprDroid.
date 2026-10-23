import type {
  AchievementDefinition,
  ProgressionResult,
  ProgressionState,
  QuestDefinition,
  RealmEvent,
} from './types'
import { levelForTotalXp } from './xpCurve'

export const XP_REWARDS = {
  objectiveMet: 40,
  projectCompleted: 150,
  lessonStudied: 30,
  fileSaved: 2,
  codeRun: 3,
} as const

export const QUESTS: QuestDefinition[] = [
  { id: 'first-spark', title: 'First Spark', description: 'Run your code for the first time.',
    targetCount: 1, rewardXp: 20, measureProgress: (state) => state.codeRunCount },
  { id: 'commit-to-disk', title: 'Commit to Disk', description: 'Save your work 10 times.',
    targetCount: 10, rewardXp: 40, measureProgress: (state) => state.fileSaveCount },
  { id: 'proof-of-work', title: 'Proof of Work', description: 'Verify 3 objectives.',
    targetCount: 3, rewardXp: 60, measureProgress: (state) => state.metObjectiveKeys.length },
  { id: 'project-zero', title: 'Project Zero', description: 'Complete your first project.',
    targetCount: 1, rewardXp: 80, measureProgress: (state) => state.completedProjectIds.length },
  { id: 'scholar-of-the-grid', title: 'Scholar of the Grid', description: 'Study 3 lessons in the Lesson Lab.',
    targetCount: 3, rewardXp: 90, measureProgress: (state) => state.studiedLessonIds.length },
  { id: 'flow-state', title: 'Flow State', description: 'Reach a 40-keystroke combo.',
    targetCount: 40, rewardXp: 50, measureProgress: (state) => state.bestCombo },
]

export const ACHIEVEMENTS: AchievementDefinition[] = [
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
  { id: 'lab-rat', title: 'Lab Rat', description: 'Study all 7 visualizer lessons.',
    isUnlocked: (state) => state.studiedLessonIds.length >= 7 },
]

function baseXpAndState(state: ProgressionState, event: RealmEvent): { next: ProgressionState; xp: number } {
  switch (event.type) {
    case 'objective_met': {
      const key = `${event.projectId}/${event.objectiveId}`
      if (state.metObjectiveKeys.includes(key)) return { next: state, xp: 0 }
      return { next: { ...state, metObjectiveKeys: [...state.metObjectiveKeys, key] }, xp: XP_REWARDS.objectiveMet }
    }
    case 'project_completed': {
      if (state.completedProjectIds.includes(event.projectId)) return { next: state, xp: 0 }
      return {
        next: { ...state, completedProjectIds: [...state.completedProjectIds, event.projectId] },
        xp: XP_REWARDS.projectCompleted,
      }
    }
    case 'lesson_studied': {
      if (state.studiedLessonIds.includes(event.lessonId)) return { next: state, xp: 0 }
      return { next: { ...state, studiedLessonIds: [...state.studiedLessonIds, event.lessonId] }, xp: XP_REWARDS.lessonStudied }
    }
    case 'file_saved':
      return { next: { ...state, fileSaveCount: state.fileSaveCount + 1 }, xp: XP_REWARDS.fileSaved }
    case 'code_run':
      return { next: { ...state, codeRunCount: state.codeRunCount + 1 }, xp: XP_REWARDS.codeRun }
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
  return {
    state: interim,
    gainedXp,
    completedQuests,
    unlockedAchievements,
    reachedLevel: levelAfter > levelBefore ? levelAfter : null,
  }
}
