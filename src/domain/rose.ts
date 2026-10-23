/** The shared rose grows with the household's bond XP (server-maintained, daily-capped). */

export const ROSE_STAGE_LABELS = ['Dormant', 'Soft glow', 'First sparkle', 'Steady shimmer', 'Radiant shine', 'Full sanctuary glow'] as const
export const ROSE_STAGE_THRESHOLDS = [0, 12, 30, 60, 100, 160] as const

export function roseStage(bondXp: number): number {
  let stage = 0
  ROSE_STAGE_THRESHOLDS.forEach((threshold, index) => {
    if (bondXp >= threshold) stage = index
  })
  return stage
}

export interface RoseProgress {
  stage: number
  label: string
  /** 0..1 progress toward the next stage (1 at the top stage). */
  progress: number
  nextAt: number | null
}

export function roseProgress(bondXp: number): RoseProgress {
  const xp = Math.max(0, Math.floor(bondXp))
  const stage = roseStage(xp)
  const floor = ROSE_STAGE_THRESHOLDS[stage] ?? 0
  const next = ROSE_STAGE_THRESHOLDS[stage + 1]
  return {
    stage,
    label: ROSE_STAGE_LABELS[stage] ?? ROSE_STAGE_LABELS[0],
    progress: next === undefined ? 1 : (xp - floor) / (next - floor),
    nextAt: next ?? null,
  }
}
