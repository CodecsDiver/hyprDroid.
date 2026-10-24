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

describe('bigger algorithms', () => {
  it('heap sort ends sorted and settles every position', async () => {
    const { sortFrames } = await import('./sorting')
    const input = [9, 4, 7, 1, 8, 2, 6, 3, 5, 10, 0]
    const frames = sortFrames('heap', input)
    expect(frames.at(-1)!.values).toEqual([...input].sort((a, b) => a - b))
    expect(frames.at(-1)!.settled).toHaveLength(input.length)
  })

  it('A* finds a shortest path while looking at fewer cells than BFS on open ground', () => {
    const goal = { row: 9, column: 9 }
    const bfs = gridSearchFrames('bfs', 10, 10, new Set(), { row: 0, column: 0 }, goal).at(-1)!
    const astar = gridSearchFrames('astar', 10, 10, new Set(), { row: 0, column: 0 }, goal).at(-1)!
    expect(astar.path).toHaveLength(bfs.path!.length)
    expect(astar.visited.length).toBeLessThan(bfs.visited.length)
  })

  it('A* reports no path when the goal is walled in', () => {
    const walls = new Set(['0,1', '1,0', '1,1'])
    const last = gridSearchFrames('astar', 3, 3, walls, { row: 0, column: 0 }, { row: 2, column: 2 }).at(-1)!
    expect(last.path).toBeNull()
  })

  it('Dijkstra finds the shortest distances on the road graph', async () => {
    const { dijkstraFrames, ROAD_GRAPH } = await import('./graph')
    expect(dijkstraFrames(ROAD_GRAPH, 'A').at(-1)!.labels).toEqual({ A: '0', B: '4', C: '2', D: '9', E: '11', F: '14' })
  })

  it('topological order respects every dependency', async () => {
    const { topologicalFrames, MORNING_GRAPH } = await import('./graph')
    const order = topologicalFrames(MORNING_GRAPH).at(-1)!.order
    expect(order).toHaveLength(MORNING_GRAPH.nodes.length)
    for (const edge of MORNING_GRAPH.edges) expect(order.indexOf(edge.from)).toBeLessThan(order.indexOf(edge.to))
  })

  it('dynamic programming tables end on the right answers', async () => {
    const { lcsFrames, knapsackFrames, coinFrames } = await import('./dp')
    const answerOf = (frames: ReturnType<typeof lcsFrames>) => {
      const last = frames.at(-1)!
      return last.table[last.answer![0]][last.answer![1]]
    }
    expect(answerOf(lcsFrames('ABCBDAB', 'BDCABA'))).toBe(4)
    expect(answerOf(knapsackFrames([1, 3, 4, 5], [1, 4, 5, 7], 7))).toBe(9)
    expect(answerOf(coinFrames([1, 5, 6, 9], 11))).toBe(2)
    expect(answerOf(coinFrames([2], 3))).toBe(Infinity)
  })

  it('N-Queens backtracking reaches the first solution of the 6x6 board', async () => {
    const { queensFrames } = await import('./nqueens')
    const last = queensFrames(6).at(-1)!
    expect(last.solved).toBe(true)
    expect(last.queens).toEqual([1, 3, 5, 0, 2, 4])
  })
})
