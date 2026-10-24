import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { LAB_COURSES } from './courses'
import { chunkCount, evaluateTyping, splitCode } from './typingCourse'

describe.each(LAB_COURSES)('course $id', (course) => {
  it('is real, runnable Python that prints the expected output', () => {
    const run = spawnSync('python3', ['-B', '-c', course.code], { encoding: 'utf-8', timeout: 15000 })
    expect(run.stderr).toBe('')
    expect(run.stdout).toBe(course.expectedOutput)
  })

  it('can be typed exactly as written, ten lines at a time, until complete', () => {
    const lines = splitCode(course.code)
    expect(lines.every((line) => !line.includes('\t'))).toBe(true)
    let unlocked = 1
    for (let typedLines = 1; typedLines <= lines.length; typedLines++) {
      const result = evaluateTyping(lines, lines.slice(0, typedLines).join('\n'))
      expect(result.mismatch).toBeNull()
      expect(result.unlockedChunks).toBeGreaterThanOrEqual(unlocked)
      unlocked = result.unlockedChunks
    }
    expect(evaluateTyping(lines, lines.join('\n')).isComplete).toBe(true)
    expect(unlocked).toBe(chunkCount(lines.length))
  })

  it('has at least two chunks, so the next part is actually handed out later', () => {
    expect(chunkCount(splitCode(course.code).length)).toBeGreaterThanOrEqual(2)
  })
})

describe('lab sections', () => {
  it('keeps the original twelve as the Beginner Deep End and adds the bigger algorithms', () => {
    expect(LAB_COURSES.filter((course) => course.section === 'Beginner Deep End')).toHaveLength(12)
    expect(LAB_COURSES.filter((course) => course.section === 'Bigger Algorithms').map((course) => course.id)).toEqual([
      'sort-heap', 'search-astar', 'graph-dijkstra', 'graph-topological', 'dp-lcs', 'dp-knapsack', 'dp-coins', 'backtrack-queens',
    ])
  })
  it('bigger algorithms are long enough to need at least three chunks', () => {
    for (const course of LAB_COURSES.filter((candidate) => candidate.section === 'Bigger Algorithms')) {
      expect(splitCode(course.code).length, course.id).toBeGreaterThan(11)
    }
  })
})

describe('lab catalogue', () => {
  it('has the five sorting algorithms and unique ids', () => {
    expect(LAB_COURSES.filter((course) => course.group === 'Sorting').map((course) => course.id)).toEqual([
      'sort-bubble', 'sort-insertion', 'sort-selection', 'sort-quick', 'sort-merge',
    ])
    expect(new Set(LAB_COURSES.map((course) => course.id)).size).toBe(LAB_COURSES.length)
  })
})
