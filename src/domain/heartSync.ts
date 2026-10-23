/** "Hearts synced": both people tap the heart within a short window (the original's `Hearts synced` combo). */

export const HEART_SYNC_WINDOW_MS = 5_000

export function detectHeartSync(mineMs: readonly number[], partnerMs: readonly number[], windowMs = HEART_SYNC_WINDOW_MS): boolean {
  return mineMs.some((mine) => partnerMs.some((theirs) => Math.abs(mine - theirs) <= windowMs))
}

/** Rolling record of recent taps, pruned so it cannot grow without bound. */
export class HeartTapLedger {
  private mine: number[] = []
  private partner: number[] = []
  constructor(private readonly windowMs = HEART_SYNC_WINDOW_MS, private readonly keep = 20) {}

  recordMine(atMs: number): boolean {
    this.mine = [...this.mine, atMs].slice(-this.keep)
    return detectHeartSync([atMs], this.partner, this.windowMs)
  }

  recordPartner(atMs: number): boolean {
    this.partner = [...this.partner, atMs].slice(-this.keep)
    return detectHeartSync(this.mine, [atMs], this.windowMs)
  }
}
