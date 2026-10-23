import { describe, expect, it } from 'vitest'
import { describeLevelUp, levelUpTier } from './levelUpTier'

describe('levelUpTier', () => {
  it('picks the rarest applicable tier', () => {
    expect(levelUpTier(2, false)).toBe('standard')
    expect(levelUpTier(5, false)).toBe('major')
    expect(levelUpTier(3, true)).toBe('rank')
    expect(levelUpTier(10, false)).toBe('milestone')
    expect(levelUpTier(10, true)).toBe('milestone')
    expect(levelUpTier(25, true)).toBe('legend')
    expect(levelUpTier(50, false)).toBe('legend')
  })
})

describe('describeLevelUp', () => {
  it('makes bigger tiers bigger and longer', () => {
    const order = [describeLevelUp(2, false), describeLevelUp(5, false), describeLevelUp(8, true), describeLevelUp(10, false), describeLevelUp(25, false)]
    for (let index = 1; index < order.length; index++) {
      expect(order[index].particleScale).toBeGreaterThan(order[index - 1].particleScale)
      expect(order[index].fireworkRounds).toBeGreaterThan(order[index - 1].fireworkRounds)
      expect(order[index].lifetimeMs).toBeGreaterThan(order[index - 1].lifetimeMs)
    }
  })

  it('grows within a tier as the level climbs', () => {
    expect(describeLevelUp(4, false).particleScale).toBeGreaterThan(describeLevelUp(2, false).particleScale)
    expect(describeLevelUp(2, false).headline).toBe('LEVEL UP')
    expect(describeLevelUp(3, true).headline).toBe('RANK UP')
  })
})
