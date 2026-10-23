/** Math for synchronised playback. Server time is the single source of truth. */

export type SessionState = 'stopped' | 'playing' | 'paused'

export interface SyncSession {
  state: SessionState
  positionMs: number
  /** Server timestamp (ms since epoch) at which `positionMs` was true. */
  updatedAtMs: number
  revision: number
}

export interface ClockSample {
  clientSentMs: number
  serverMs: number
  clientReceivedMs: number
}

/** Offset (server − client) from the lowest-latency sample, which is the most trustworthy. */
export function estimateClockOffset(samples: readonly ClockSample[]): number {
  if (samples.length === 0) return 0
  const best = [...samples].sort((a, b) => a.clientReceivedMs - a.clientSentMs - (b.clientReceivedMs - b.clientSentMs))[0]!
  return best.serverMs - (best.clientSentMs + best.clientReceivedMs) / 2
}

export function expectedPositionMs(session: SyncSession, serverNowMs: number, durationMs?: number | null): number {
  if (session.state !== 'playing') return session.positionMs
  const position = session.positionMs + Math.max(0, serverNowMs - session.updatedAtMs)
  return durationMs && durationMs > 0 ? Math.min(position, durationMs) : position
}

export type Correction =
  | { action: 'none'; playbackRate: 1 }
  | { action: 'nudge'; playbackRate: number }
  | { action: 'seek'; targetMs: number; playbackRate: 1 }

export interface CorrectionThresholds {
  /** Below this drift we leave playback alone. */
  toleranceMs: number
  /** Above this drift we seek instead of nudging playbackRate. */
  seekMs: number
}

/** Small drift is eased out with a barely audible rate change; large drift seeks. */
export function planCorrection(currentMs: number, expectedMs: number, thresholds: CorrectionThresholds = { toleranceMs: 250, seekMs: 1500 }): Correction {
  const drift = expectedMs - currentMs
  const magnitude = Math.abs(drift)
  if (magnitude <= thresholds.toleranceMs) return { action: 'none', playbackRate: 1 }
  if (magnitude >= thresholds.seekMs) return { action: 'seek', targetMs: Math.max(0, expectedMs), playbackRate: 1 }
  return { action: 'nudge', playbackRate: drift > 0 ? 1.04 : 0.96 }
}

/** Sync is only ever active while BOTH people have opted in (enforced server-side too). */
export function isSyncActive(consent: { me: boolean; partner: boolean }): boolean {
  return consent.me && consent.partner
}
