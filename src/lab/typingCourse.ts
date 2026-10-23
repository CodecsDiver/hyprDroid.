export const LINES_PER_CHUNK = 10

const normalizeLine = (line: string): string => line.replace(/\t/g, '    ').replace(/\s+$/, '')

export function splitCode(code: string): string[] {
  return code.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n')
}

export function chunkCount(totalLines: number): number {
  return Math.max(1, Math.ceil(totalLines / LINES_PER_CHUNK))
}

export interface TypingLineMark {
  /** 1-based line number in the typed file. */
  line: number
  kind: 'ok' | 'bad'
}

export interface TypingEvaluation {
  /** Consecutive lines, from the top of the file, that match exactly. */
  matchedLines: number
  /** Chunks fully typed correctly (a chunk counts once its last line matches exactly). */
  completedChunks: number
  /** Chunks the student may currently see: all completed ones plus the next one. */
  unlockedChunks: number
  isComplete: boolean
  /** The first wrong line, once the student has moved past it or typed something that cannot become correct. */
  mismatch: { line: number; expected: string; typed: string } | null
  /** True while the last typed line is still a correct prefix of the expected line. */
  isMidLine: boolean
  marks: TypingLineMark[]
}

/**
 * Compares what the student typed to the expected code. Lines above the cursor line must match
 * exactly (ignoring trailing spaces). The line being typed is only wrong once it can no longer
 * become the expected line, so half-typed lines never show as errors.
 */
export function evaluateTyping(expectedLines: string[], typedText: string): TypingEvaluation {
  const expected = expectedLines.map(normalizeLine)
  const typed = typedText.replace(/\r\n/g, '\n').split('\n')
  const lastIndex = typed.length - 1

  let matchedLines = 0
  let mismatch: TypingEvaluation['mismatch'] = null
  let isMidLine = false
  const marks: TypingLineMark[] = []

  for (let index = 0; index < typed.length; index++) {
    const typedLine = normalizeLine(typed[index])
    const expectedLine = expected[index]
    const isCursorLine = index === lastIndex

    if (expectedLine === undefined) {
      if (typedLine !== '' || !isCursorLine) {
        mismatch = { line: index + 1, expected: '(nothing more to type)', typed: typedLine }
        marks.push({ line: index + 1, kind: 'bad' })
      }
      break
    }
    if (typedLine === expectedLine) {
      // A fully typed final line counts even before Enter is pressed.
      matchedLines = index + 1
      marks.push({ line: index + 1, kind: 'ok' })
      continue
    }
    if (isCursorLine && typed[index].length > 0 && expectedLine.startsWith(typed[index].replace(/\t/g, '    '))) {
      isMidLine = true
      break
    }
    if (isCursorLine && typed[index] === '') break
    mismatch = { line: index + 1, expected: expectedLine, typed: typedLine }
    marks.push({ line: index + 1, kind: 'bad' })
    break
  }

  const totalChunks = chunkCount(expected.length)
  const completedChunks = Math.min(totalChunks, Math.floor(matchedLines / LINES_PER_CHUNK) + (matchedLines === expected.length ? 1 : 0))
  const isComplete = matchedLines === expected.length
  const unlockedChunks = Math.min(totalChunks, completedChunks + 1)
  return { matchedLines, completedChunks, unlockedChunks, isComplete, mismatch, isMidLine, marks }
}

/** The ten (or fewer, for the last chunk) lines of the given zero-based chunk. */
export function chunkLines(expectedLines: string[], chunkIndex: number): string[] {
  return expectedLines.slice(chunkIndex * LINES_PER_CHUNK, (chunkIndex + 1) * LINES_PER_CHUNK)
}
