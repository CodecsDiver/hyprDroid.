export const MAX_STRIKES = 3

export interface StrikeState {
  /** Failed "Check my work" runs per mission since it was last cleared. */
  strikes: Record<string, number>
  /** Missions whose full commented solution may be opened. */
  solutionUnlocked: Record<string, boolean>
}

export interface StrikeOutcome {
  strikes: number
  /** True only on the check that used the last strike of a mission whose solution was still locked. */
  justUnlocked: boolean
}

/** A failed Check my work is the only thing that costs a strike: running code never does. */
export function recordFailedCheck(state: StrikeState, missionId: string): StrikeOutcome {
  const strikes = Math.min(MAX_STRIKES, (state.strikes[missionId] ?? 0) + 1)
  state.strikes[missionId] = strikes
  const justUnlocked = strikes >= MAX_STRIKES && !state.solutionUnlocked[missionId]
  if (strikes >= MAX_STRIKES) state.solutionUnlocked[missionId] = true
  return { strikes, justUnlocked }
}

/** Finishing a mission wipes its strikes and keeps its solution available for reading afterwards. */
export function recordMissionCleared(state: StrikeState, missionId: string): void {
  state.strikes[missionId] = 0
  state.solutionUnlocked[missionId] = true
}
