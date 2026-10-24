/** One change to the typed text, stamped with active (not wall-clock) milliseconds since the run began. */
export interface GhostEdit {
  t: number
  at: number
  del: number
  ins: string
}

export interface GhostRecord {
  /** What this ghost belongs to, e.g. "mission:loop-lab" or "lab:sort-bubble". */
  key: string
  ms: number
  recordedAt: number
  startText: string
  edits: GhostEdit[]
}

/** Pauses longer than this count as a break and only add this much to the run's time. */
export const IDLE_CAP_MS = 15_000
export const MAX_EDITS_PER_GHOST = 6000

/** The smallest single edit that turns `before` into `after`: shared start and end are kept. */
export function diffEdit(before: string, after: string): Omit<GhostEdit, 't'> | null {
  if (before === after) return null
  let prefix = 0
  const shortest = Math.min(before.length, after.length)
  while (prefix < shortest && before[prefix] === after[prefix]) prefix++
  let suffix = 0
  while (suffix < shortest - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++
  return { at: prefix, del: before.length - prefix - suffix, ins: after.slice(prefix, after.length - suffix) }
}

/** The text a ghost had typed after `ms` active milliseconds. */
export function ghostTextAt(record: Pick<GhostRecord, 'startText' | 'edits'>, ms: number): string {
  let text = record.startText
  for (const edit of record.edits) {
    if (edit.t > ms) break
    text = text.slice(0, edit.at) + edit.ins + text.slice(edit.at + edit.del)
  }
  return text
}

/**
 * Records a typing run. Time only counts while the student is active: the clock starts at the first
 * change and a long pause adds at most IDLE_CAP_MS, so a coffee break does not ruin a record.
 */
export class RunRecorder {
  private text: string
  private readonly startText: string
  private startedAt: number | null = null
  private lastAt = 0
  private active = 0
  private readonly edits: GhostEdit[] = []

  constructor(startText: string) {
    this.startText = startText
    this.text = startText
  }

  get isRunning(): boolean {
    return this.startedAt !== null
  }

  /** Active milliseconds so far (0 before the first change). */
  elapsed(now: number): number {
    if (this.startedAt === null) return 0
    return this.active + Math.min(Math.max(0, now - this.lastAt), IDLE_CAP_MS)
  }

  change(text: string, now: number): void {
    const edit = diffEdit(this.text, text)
    if (!edit) return
    if (this.startedAt === null) {
      this.startedAt = now
      this.lastAt = now
    } else {
      this.active += Math.min(Math.max(0, now - this.lastAt), IDLE_CAP_MS)
      this.lastAt = now
    }
    this.text = text
    this.edits.push({ t: this.active, ...edit })
  }

  /** Finishes the run. Returns null when nothing was typed or the run is too long to store. */
  finish(key: string, now: number): GhostRecord | null {
    if (this.startedAt === null || this.edits.length === 0 || this.edits.length > MAX_EDITS_PER_GHOST) return null
    return { key, ms: Math.max(1, Math.round(this.elapsed(now))), recordedAt: now, startText: this.startText, edits: this.edits.slice() }
  }
}

export type GhostVerdict = 'first' | 'faster' | 'slower'

/** A new run replaces the ghost only when there is none yet or it is strictly faster. */
export function judgeAgainstGhost(current: GhostRecord | undefined, newMs: number): GhostVerdict {
  if (!current) return 'first'
  return newMs < current.ms ? 'faster' : 'slower'
}

export function formatMs(ms: number): string {
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`
}

export function formatDelta(ms: number): string {
  const sign = ms > 0 ? '+' : ms < 0 ? '-' : ''
  return `${sign}${(Math.abs(ms) / 1000).toFixed(1)}s`
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Accepts a stored ghost only if every field has the expected shape; anything else is dropped. */
export function sanitizeGhost(key: string, value: unknown): GhostRecord | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  if (!isFiniteNumber(source.ms) || source.ms <= 0 || !isFiniteNumber(source.recordedAt)) return null
  if (typeof source.startText !== 'string' || source.startText.length > 20_000) return null
  if (!Array.isArray(source.edits) || source.edits.length === 0 || source.edits.length > MAX_EDITS_PER_GHOST) return null
  const edits: GhostEdit[] = []
  for (const entry of source.edits) {
    const edit = entry as Record<string, unknown>
    if (!isFiniteNumber(edit?.t) || !isFiniteNumber(edit?.at) || !isFiniteNumber(edit?.del) || typeof edit?.ins !== 'string') return null
    if (edit.at < 0 || edit.del < 0 || edit.ins.length > 20_000) return null
    edits.push({ t: edit.t, at: edit.at, del: edit.del, ins: edit.ins })
  }
  return { key, ms: source.ms, recordedAt: source.recordedAt, startText: source.startText, edits }
}
