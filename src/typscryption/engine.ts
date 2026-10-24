import { LEVEL_COUNT, PACE_BANDS, SPEEDCODER_LINE_SECONDS, TYPICAL_LINE_CHARS } from './levels'

/** A small seeded generator so a bot's pace is lively but repeatable in tests. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0x100000000
  }
}

export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

const clampLevel = (level: number) => Math.min(LEVEL_COUNT, Math.max(1, Math.round(level)))
const lineSeconds = (level: number) => SPEEDCODER_LINE_SECONDS[clampLevel(level) - 1]

/** Seconds the bot needs for one line: scales with the line's length, the level's average and the placement typing factor. */
export function botLineSeconds(level: number, characters: number, typingFactor: number): number {
  const lengthScale = Math.max(0.35, Math.pow(Math.max(characters, 1) / TYPICAL_LINE_CHARS, 0.85))
  return lineSeconds(level) * lengthScale * typingFactor
}

/** When the bot finishes each line of a block, as seconds since GO. A little jitter keeps it from feeling like a metronome. */
export function botLineSchedule(level: number, lines: readonly string[], typingFactor: number, random: () => number): number[] {
  let elapsed = 0
  return lines.map((line) => {
    elapsed += botLineSeconds(level, line.trim().length, typingFactor) * (0.9 + random() * 0.2)
    return elapsed
  })
}

/** Reading the block, spotting the answer, then typing the line. */
export function botGuessSeconds(level: number, blockLines: number, answerCharacters: number, typingFactor: number): number {
  const thinking = lineSeconds(level) * 0.4 * (1 + 0.12 * blockLines)
  return thinking * typingFactor + botLineSeconds(level, answerCharacters, typingFactor) * 0.6
}

/** Reading the block, finding the bug, then retyping the line. */
export function botFixSeconds(level: number, blockLines: number, fixCharacters: number, typingFactor: number): number {
  const thinking = lineSeconds(level) * 0.55 * (1 + 0.15 * blockLines)
  return thinking * typingFactor + botLineSeconds(level, fixCharacters, typingFactor) * 0.6
}

export interface PaceReport {
  ratio: number
  label: string
  averageSecondsPerLine: number
  libraryAverage: number
}

/** The extra Speed Coder check: your pace against the library average for your own level. */
export function paceReport(level: number, totalSeconds: number, lines: readonly string[]): PaceReport {
  const characters = lines.reduce((sum, line) => sum + line.trim().length, 0)
  const typicalLines = Math.max(1, characters / TYPICAL_LINE_CHARS)
  const averageSecondsPerLine = totalSeconds / typicalLines
  const libraryAverage = lineSeconds(level)
  const ratio = averageSecondsPerLine / libraryAverage
  const band = PACE_BANDS.find((candidate) => ratio <= candidate.upTo) ?? PACE_BANDS[PACE_BANDS.length - 1]
  return { ratio, label: band.label, averageSecondsPerLine, libraryAverage }
}

export interface Adaptation {
  level: number
  winStreak: number
  lossStreak: number
  change: -1 | 0 | 1
}

export const WINS_TO_LEVEL_UP = 2
export const LOSSES_TO_LEVEL_DOWN = 2

/** Two match wins in a row move you up a level, two losses in a row move you down; the streak resets after a move. */
export function adaptLevel(level: number, winStreak: number, lossStreak: number, won: boolean): Adaptation {
  const wins = won ? winStreak + 1 : 0
  const losses = won ? 0 : lossStreak + 1
  if (wins >= WINS_TO_LEVEL_UP && level < LEVEL_COUNT) return { level: level + 1, winStreak: 0, lossStreak: 0, change: 1 }
  if (losses >= LOSSES_TO_LEVEL_DOWN && level > 1) return { level: level - 1, winStreak: 0, lossStreak: 0, change: -1 }
  return { level, winStreak: wins, lossStreak: losses, change: 0 }
}
