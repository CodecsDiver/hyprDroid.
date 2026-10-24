export interface GridPoint {
  row: number
  column: number
}

export type GridSearchKind = 'bfs' | 'dfs' | 'astar'

export interface GridSearchFrame {
  visited: string[]
  frontier: string[]
  current: string | null
  path: string[] | null
  note: string
}

export const pointKey = (point: GridPoint): string => `${point.row},${point.column}`

function parseKey(key: string): GridPoint {
  const [row, column] = key.split(',').map(Number)
  return { row, column }
}

const DIRECTIONS: ReadonlyArray<GridPoint> = [
  { row: -1, column: 0 },
  { row: 0, column: 1 },
  { row: 1, column: 0 },
  { row: 0, column: -1 },
]

/**
 * Breadth-first search uses a queue (take from the front); depth-first uses a stack (take from the back).
 * That single difference is the whole idea.
 */
export function gridSearchFrames(
  kind: GridSearchKind,
  rows: number,
  columns: number,
  walls: ReadonlySet<string>,
  start: GridPoint,
  goal: GridPoint,
): GridSearchFrame[] {
  if (kind === 'astar') return astarFrames(rows, columns, walls, start, goal)
  const frames: GridSearchFrame[] = []
  const visited = new Set<string>()
  const cameFrom = new Map<string, string>()
  const frontier: string[] = [pointKey(start)]
  const queued = new Set<string>(frontier)
  const goalKey = pointKey(goal)

  const frame = (current: string | null, path: string[] | null, note: string) =>
    frames.push({ visited: [...visited], frontier: [...frontier], current, path, note })

  frame(null, null, `Start at (${start.row}, ${start.column}) with a ${kind === 'bfs' ? 'queue' : 'stack'}`)
  while (frontier.length > 0) {
    const currentKey = kind === 'bfs' ? frontier.shift()! : frontier.pop()!
    visited.add(currentKey)

    if (currentKey === goalKey) {
      const path = [currentKey]
      while (cameFrom.has(path[0])) path.unshift(cameFrom.get(path[0])!)
      frame(currentKey, path, `Reached the goal. Path length: ${path.length - 1} steps`)
      return frames
    }

    const current = parseKey(currentKey)
    for (const direction of DIRECTIONS) {
      const next = { row: current.row + direction.row, column: current.column + direction.column }
      const nextKey = pointKey(next)
      const isOutside = next.row < 0 || next.column < 0 || next.row >= rows || next.column >= columns
      if (isOutside || walls.has(nextKey) || visited.has(nextKey) || queued.has(nextKey)) continue
      queued.add(nextKey)
      cameFrom.set(nextKey, currentKey)
      frontier.push(nextKey)
    }
    frame(currentKey, null, `Visit (${current.row}, ${current.column}); ${frontier.length} waiting`)
  }
  frame(null, null, 'The frontier is empty: there is no path')
  return frames
}

/**
 * A* picks the waiting cell with the lowest (steps so far + straight-line guess to the goal), so it heads for the goal
 * instead of spreading in rings like BFS.
 */
function astarFrames(rows: number, columns: number, walls: ReadonlySet<string>, start: GridPoint, goal: GridPoint): GridSearchFrame[] {
  const frames: GridSearchFrame[] = []
  const visited = new Set<string>()
  const cameFrom = new Map<string, string>()
  const cost = new Map<string, number>([[pointKey(start), 0]])
  const guess = (key: string): number => {
    const point = parseKey(key)
    return Math.abs(point.row - goal.row) + Math.abs(point.column - goal.column)
  }
  const frontier: string[] = [pointKey(start)]
  const goalKey = pointKey(goal)
  const score = (key: string) => cost.get(key)! + guess(key)

  const frame = (current: string | null, path: string[] | null, note: string) =>
    frames.push({ visited: [...visited], frontier: [...frontier], current, path, note })

  frame(null, null, `Start at (${start.row}, ${start.column}): always expand the cell with the lowest steps + guess`)
  while (frontier.length > 0) {
    frontier.sort((a, b) => score(a) - score(b) || guess(a) - guess(b))
    const currentKey = frontier.shift()!
    if (visited.has(currentKey)) continue
    visited.add(currentKey)

    if (currentKey === goalKey) {
      const path = [currentKey]
      while (cameFrom.has(path[0])) path.unshift(cameFrom.get(path[0])!)
      frame(currentKey, path, `Reached the goal in ${path.length - 1} steps, after looking at only ${visited.size} cells`)
      return frames
    }

    const current = parseKey(currentKey)
    for (const direction of DIRECTIONS) {
      const next = { row: current.row + direction.row, column: current.column + direction.column }
      const nextKey = pointKey(next)
      const isOutside = next.row < 0 || next.column < 0 || next.row >= rows || next.column >= columns
      if (isOutside || walls.has(nextKey) || visited.has(nextKey)) continue
      const newCost = cost.get(currentKey)! + 1
      if (newCost < (cost.get(nextKey) ?? Infinity)) {
        cost.set(nextKey, newCost)
        cameFrom.set(nextKey, currentKey)
        if (!frontier.includes(nextKey)) frontier.push(nextKey)
      }
    }
    frame(currentKey, null, `Visit (${current.row}, ${current.column}): ${cost.get(currentKey)} steps so far, about ${guess(currentKey)} to go`)
  }
  frame(null, null, 'No cells are left to try: there is no path')
  return frames
}
