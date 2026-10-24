import { describe, expect, it } from 'vitest'
import { MAX_STRIKES, recordFailedCheck, recordMissionCleared, type StrikeState } from './strikes'

const fresh = (): StrikeState => ({ strikes: {}, solutionUnlocked: {} })

describe('strikes', () => {
  it('counts one strike per failed check and unlocks the solution on the third', () => {
    const state = fresh()
    expect(recordFailedCheck(state, 'a')).toEqual({ strikes: 1, justUnlocked: false })
    expect(recordFailedCheck(state, 'a')).toEqual({ strikes: 2, justUnlocked: false })
    expect(state.solutionUnlocked.a).toBeUndefined()
    expect(recordFailedCheck(state, 'a')).toEqual({ strikes: MAX_STRIKES, justUnlocked: true })
    expect(state.solutionUnlocked.a).toBe(true)
  })

  it('does not announce the unlock twice and never goes past the maximum', () => {
    const state = fresh()
    for (let i = 0; i < 3; i++) recordFailedCheck(state, 'a')
    expect(recordFailedCheck(state, 'a')).toEqual({ strikes: MAX_STRIKES, justUnlocked: false })
  })

  it('keeps missions separate', () => {
    const state = fresh()
    recordFailedCheck(state, 'a')
    expect(state.strikes.b).toBeUndefined()
  })

  it('clearing a mission resets its strikes and keeps the solution readable', () => {
    const state = fresh()
    recordFailedCheck(state, 'a')
    recordMissionCleared(state, 'a')
    expect(state.strikes.a).toBe(0)
    expect(state.solutionUnlocked.a).toBe(true)
  })
})
