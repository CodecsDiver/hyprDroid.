import { describe, expect, it } from 'vitest'
import { randomValues, SORT_ALGORITHMS, sortFrames } from './sorting'

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

describe.each(SORT_ALGORITHMS)('$label', ({ id }) => {
  it('ends with the input sorted, for many random arrays', () => {
    const random = seededRandom(42)
    for (let round = 0; round < 40; round++) {
      const input = randomValues(1 + Math.floor(random() * 16), random)
      const frames = sortFrames(id, input)
      const last = frames[frames.length - 1]
      expect(last.values).toEqual([...input].sort((a, b) => a - b))
      expect(last.settled.sort((a, b) => a - b)).toEqual(input.map((_, index) => index))
    }
  })

  it('never loses or invents values in any frame', () => {
    const input = [9, 3, 7, 3, 1, 8]
    const expected = [...input].sort((a, b) => a - b)
    for (const frame of sortFrames(id, input)) {
      if (id === 'merge') continue // merge writes into the array from copies, so mid-frames may repeat values
      expect([...frame.values].sort((a, b) => a - b)).toEqual(expected)
    }
  })

  it('handles empty and single-element input', () => {
    expect(sortFrames(id, []).at(-1)?.values).toEqual([])
    expect(sortFrames(id, [4]).at(-1)?.values).toEqual([4])
  })
})
