export type RealmEvent =
  | { type: 'objective_met'; projectId: string; objectiveId: string }
  | { type: 'project_completed'; projectId: string }
  | { type: 'lesson_studied'; lessonId: string }
  | { type: 'file_saved' }
  | { type: 'code_run' }
  | { type: 'combo_peak'; combo: number }

export interface ProgressionState {
  schemaVersion: 1
  totalXp: number
  fileSaveCount: number
  codeRunCount: number
  bestCombo: number
  /** `projectId/objectiveId` keys, so XP for an objective is only ever awarded once. */
  metObjectiveKeys: string[]
  completedProjectIds: string[]
  studiedLessonIds: string[]
  completedQuestIds: string[]
  unlockedAchievementIds: string[]
}

export interface QuestDefinition {
  id: string
  title: string
  description: string
  targetCount: number
  rewardXp: number
  measureProgress: (state: ProgressionState) => number
}

export interface AchievementDefinition {
  id: string
  title: string
  description: string
  isUnlocked: (state: ProgressionState) => boolean
}

export interface ProgressionResult {
  state: ProgressionState
  gainedXp: number
  completedQuests: QuestDefinition[]
  unlockedAchievements: AchievementDefinition[]
  reachedLevel: number | null
}

export function createEmptyProgression(): ProgressionState {
  return {
    schemaVersion: 1,
    totalXp: 0,
    fileSaveCount: 0,
    codeRunCount: 0,
    bestCombo: 0,
    metObjectiveKeys: [],
    completedProjectIds: [],
    studiedLessonIds: [],
    completedQuestIds: [],
    unlockedAchievementIds: [],
  }
}
