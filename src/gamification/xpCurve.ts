export interface LevelProgress {
  level: number
  xpIntoLevel: number
  xpSpanOfLevel: number
  /** 0..1 position inside the current level, always derived from total XP alone. */
  fraction: number
}

/** Total XP required to reach `level`. Level 1 needs none. */
export function totalXpRequiredForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.round(100 * Math.pow(level - 1, 1.6))
}

export function levelForTotalXp(totalXp: number): number {
  let level = 1
  while (totalXpRequiredForLevel(level + 1) <= totalXp) level++
  return level
}

export function describeLevelProgress(totalXp: number): LevelProgress {
  const level = levelForTotalXp(totalXp)
  const levelStart = totalXpRequiredForLevel(level)
  const xpSpanOfLevel = totalXpRequiredForLevel(level + 1) - levelStart
  const xpIntoLevel = totalXp - levelStart
  return { level, xpIntoLevel, xpSpanOfLevel, fraction: xpIntoLevel / xpSpanOfLevel }
}
