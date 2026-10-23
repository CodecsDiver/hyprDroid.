export type LevelUpTier = 'standard' | 'major' | 'rank' | 'milestone' | 'legend'

export interface LevelUpStyle {
  tier: LevelUpTier
  headline: string
  kicker: string
  /** HSL hues for particles and the overlay accent colours. */
  hues: number[]
  particleScale: number
  shakeScale: number
  fireworkRounds: number
  ringCount: number
  lifetimeMs: number
}

const GREEN = 145
const CYAN = 188
const VIOLET = 270
const AMBER = 42
const RED = 350

const BASE_STYLES: Record<LevelUpTier, Omit<LevelUpStyle, 'tier'>> = {
  standard: { headline: 'LEVEL UP', kicker: 'SYSTEM UPGRADE', hues: [GREEN, CYAN], particleScale: 1, shakeScale: 1, fireworkRounds: 3, ringCount: 3, lifetimeMs: 3200 },
  major: { headline: 'LEVEL UP', kicker: 'POWER SURGE', hues: [CYAN, VIOLET, GREEN], particleScale: 1.5, shakeScale: 1.4, fireworkRounds: 5, ringCount: 4, lifetimeMs: 3800 },
  rank: { headline: 'RANK UP', kicker: 'NEW CLASS UNLOCKED', hues: [VIOLET, AMBER, CYAN], particleScale: 2, shakeScale: 1.8, fireworkRounds: 7, ringCount: 5, lifetimeMs: 4400 },
  milestone: { headline: 'MILESTONE', kicker: 'OVERCLOCK', hues: [AMBER, RED, VIOLET], particleScale: 2.5, shakeScale: 2.2, fireworkRounds: 9, ringCount: 6, lifetimeMs: 5000 },
  legend: { headline: 'LEGENDARY', kicker: 'BEYOND THE GRID', hues: [AMBER, RED, VIOLET, CYAN, GREEN], particleScale: 3.2, shakeScale: 2.8, fireworkRounds: 12, ringCount: 7, lifetimeMs: 6000 },
}

export function levelUpTier(level: number, rankChanged: boolean): LevelUpTier {
  if (level % 25 === 0) return 'legend'
  if (level % 10 === 0) return 'milestone'
  if (rankChanged) return 'rank'
  if (level % 5 === 0) return 'major'
  return 'standard'
}

/** Higher levels and rarer tiers get bigger, longer, louder celebrations. */
export function describeLevelUp(level: number, rankChanged: boolean): LevelUpStyle {
  const tier = levelUpTier(level, rankChanged)
  const base = BASE_STYLES[tier]
  const growth = 1 + Math.min(level, 50) * 0.02
  return {
    tier,
    ...base,
    particleScale: Math.round(base.particleScale * growth * 100) / 100,
    shakeScale: Math.round(base.shakeScale * growth * 100) / 100,
  }
}
