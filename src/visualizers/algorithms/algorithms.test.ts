import { describe, expect, it } from 'vitest'
import { binarySearchFrames } from './binarySearch'
import { gridSearchFrames, pointKey } from './gridSearch'
import { fibonacciFrames } from './recursion'

describe('binarySearchFrames', () => {
  const values = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]

  it('finds every present value and reports its index', () => {
    values.forEach((value, index) => {
      expect(binarySearchFrames(values, value).at(-1)?.foundIndex).toBe(index)
    })
  })

  it('reports absence and never needs more than log2(n)+1 comparisons', () => {
    const last = binarySearchFrames(values, 7).at(-1)!
    expect(last.foundIndex).toBeNull()
    expect(last.steps).toBeLessThanOrEqual(Math.ceil(Math.log2(values.length)) + 1)
  })
})

describe('gridSearchFrames', () => {
  const start = { row: 0, column: 0 }
  const goal = { row: 2, column: 2 }

  it('BFS returns a shortest path', () => {
    const frames = gridSearchFrames('bfs', 3, 3, new Set(), start, goal)
    expect(frames.at(-1)?.path).toHaveLength(5)
  })

  it('DFS finds some valid path when one exists', () => {
    const path = gridSearchFrames('dfs', 3, 3, new Set(), start, goal).at(-1)?.path
    expect(path?.[0]).toBe(pointKey(start))
    expect(path?.at(-1)).toBe(pointKey(goal))
  })

  it('walks around walls and reports when the goal is sealed off', () => {
    const detour = gridSearchFrames('bfs', 3, 3, new Set(['1,0', '1,1']), start, goal).at(-1)?.path
    expect(detour).toHaveLength(5)
    const sealed = gridSearchFrames('bfs', 3, 3, new Set(['1,2', '2,1']), start, goal).at(-1)
    expect(sealed?.path).toBeNull()
  })
})

describe('fibonacciFrames', () => {
  it('computes fib(n) and records the expected number of calls', () => {
    const fib = (n: number): number => (n < 2 ? n : fib(n - 1) + fib(n - 2))
    for (let n = 0; n <= 8; n++) {
      const frames = fibonacciFrames(n)
      const nodes = frames.at(-1)!.nodes
      expect(nodes[0].result).toBe(fib(n))
      expect(nodes).toHaveLength(2 * fib(n + 1) - 1)
      expect(nodes.every((node) => node.status === 'done')).toBe(true)
    }
  })
})
