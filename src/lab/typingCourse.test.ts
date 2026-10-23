import { describe, expect, it } from 'vitest'
import { chunkCount, chunkLines, evaluateTyping, splitCode } from './typingCourse'

const lines = Array.from({ length: 23 }, (_, index) => `line_${index + 1} = ${index + 1}`)
const typedUpTo = (count: number) => lines.slice(0, count).join('\n')

describe('splitCode and chunks', () => {
  it('splits code, ignores trailing newlines and chunks by ten lines', () => {
    expect(splitCode('a\nb\n\n')).toEqual(['a', 'b'])
    expect(chunkCount(10)).toBe(1)
    expect(chunkCount(11)).toBe(2)
    expect(chunkLines(lines, 0)).toHaveLength(10)
    expect(chunkLines(lines, 2)).toHaveLength(3)
  })
})

describe('evaluateTyping', () => {
  it('starts with only the first chunk unlocked', () => {
    const result = evaluateTyping(lines, '')
    expect(result.completedChunks).toBe(0)
    expect(result.unlockedChunks).toBe(1)
    expect(result.mismatch).toBeNull()
  })

  it('does not flag a half-typed line as an error', () => {
    const result = evaluateTyping(lines, `${typedUpTo(3)}\nline_4 = `)
    expect(result.matchedLines).toBe(3)
    expect(result.isMidLine).toBe(true)
    expect(result.mismatch).toBeNull()
  })

  it('unlocks the next chunk the moment the tenth line is typed exactly, without pressing Enter', () => {
    expect(evaluateTyping(lines, typedUpTo(9)).unlockedChunks).toBe(1)
    const tenth = evaluateTyping(lines, typedUpTo(10))
    expect(tenth.completedChunks).toBe(1)
    expect(tenth.unlockedChunks).toBe(2)
  })

  it('flags the first wrong line with what was expected', () => {
    const result = evaluateTyping(lines, `${typedUpTo(4)}\nline_5 = 99`)
    expect(result.mismatch).toEqual({ line: 5, expected: 'line_5 = 5', typed: 'line_5 = 99' })
    expect(result.matchedLines).toBe(4)
    expect(result.marks.at(-1)).toEqual({ line: 5, kind: 'bad' })
  })

  it('flags a wrong earlier line even after the student has moved on', () => {
    const typed = ['line_1 = 1', 'line_2 = 3', 'line_3 = 3'].join('\n')
    expect(evaluateTyping(lines, typed).mismatch?.line).toBe(2)
  })

  it('requires exact indentation but ignores trailing spaces and tabs vs spaces', () => {
    const code = ['def f():', '    return 1']
    expect(evaluateTyping(code, 'def f():   \n    return 1').isComplete).toBe(true)
    expect(evaluateTyping(code, 'def f():\n\treturn 1').isComplete).toBe(true)
    expect(evaluateTyping(code, 'def f():\n  return 1\n').mismatch?.line).toBe(2)
  })

  it('completes when every line matches, and rejects extra lines', () => {
    expect(evaluateTyping(lines, typedUpTo(23)).isComplete).toBe(true)
    expect(evaluateTyping(lines, typedUpTo(23)).completedChunks).toBe(3)
    expect(evaluateTyping(lines, `${typedUpTo(23)}\nextra = 1`).mismatch?.line).toBe(24)
  })

  it('treats blank lines as lines to type', () => {
    const code = ['a = 1', '', 'b = 2']
    expect(evaluateTyping(code, 'a = 1\n\nb = 2').isComplete).toBe(true)
    expect(evaluateTyping(code, 'a = 1\nb = 2').mismatch?.line).toBe(2)
  })
})
