/**
 * The skill ladder. Three libraries (picked by "how long have you coded?") of three levels each:
 * nine levels from True Beginner to Advancing Learner. Every time below is an ESTIMATE of how long a
 * typical learner at that level needs, written by hand rather than measured. Tune them here.
 */
export const LEVEL_COUNT = 9
export type SkillLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export const LEVEL_NAMES: readonly string[] = [
  'True Beginner',
  'Fresh Starter',
  'Early Beginner',
  'Beginner',
  'Developing Coder',
  'Improving Coder',
  'Solid Learner',
  'Strong Learner',
  'Advancing Learner',
]

export interface SkillLibrary {
  id: 'sprout' | 'builder' | 'climber'
  name: string
  botName: string
  /** What the code in this library covers. */
  focus: string
  levels: readonly [SkillLevel, SkillLevel, SkillLevel]
}

export const SKILL_LIBRARIES: readonly SkillLibrary[] = [
  { id: 'sprout', name: 'Sprout Library', botName: 'SPROUT-BOT', focus: 'print, variables, if / else, lists and loops', levels: [1, 2, 3] },
  { id: 'builder', name: 'Builder Library', botName: 'BUILDER-BOT', focus: 'functions, dictionaries, comprehensions, while loops', levels: [4, 5, 6] },
  { id: 'climber', name: 'Climber Library', botName: 'CLIMBER-BOT', focus: 'classes, exceptions, recursion, closures, decorators', levels: [7, 8, 9] },
]

export const libraryOfLevel = (level: number): SkillLibrary => SKILL_LIBRARIES[Math.min(2, Math.max(0, Math.floor((level - 1) / 3)))]
export const levelName = (level: number): string => LEVEL_NAMES[Math.min(LEVEL_COUNT, Math.max(1, level)) - 1]

/**
 * The Speed Coder time library: how many seconds an average learner at each of the nine levels needs for one
 * typical line of about 30 characters, including the moment of thinking before typing it.
 */
export const SPEEDCODER_LINE_SECONDS: readonly number[] = [30, 24, 19, 15, 12, 10, 8.5, 7, 6]

/** Characters in the "typical line" the table above is measured on. */
export const TYPICAL_LINE_CHARS = 30

export interface PaceBand {
  /** Ratio of your seconds-per-line to the library average for your level. */
  upTo: number
  label: string
}

/** Lower is faster: a ratio of 0.8 means 20% quicker than the average learner at your level. */
export const PACE_BANDS: readonly PaceBand[] = [
  { upTo: 0.6, label: 'Elite pace' },
  { upTo: 0.8, label: 'Ahead of pace' },
  { upTo: 1.25, label: 'On pace' },
  { upTo: Infinity, label: 'Building pace' },
]
