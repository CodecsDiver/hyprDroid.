export interface QueensFrame {
  size: number
  /** queens[row] = the column of the queen already placed in that row. */
  queens: number[]
  /** The square being tried right now. */
  trying: [number, number] | null
  /** Squares that attack the one being tried. */
  attackers: Array<[number, number]>
  solved: boolean
  note: string
}

/** Backtracking: place a queen row by row; when a row has no safe square, undo the last choice and try the next one. */
export function queensFrames(size: number): QueensFrame[] {
  const frames: QueensFrame[] = []
  const columns: number[] = []
  let solved = false

  const frame = (trying: [number, number] | null, attackers: Array<[number, number]>, note: string) =>
    frames.push({ size, queens: [...columns], trying, attackers, solved, note })

  function attackersOf(row: number, column: number): Array<[number, number]> {
    return columns
      .map((earlierColumn, earlierRow): [number, number] => [earlierRow, earlierColumn])
      .filter(([earlierRow, earlierColumn]) => earlierColumn === column || Math.abs(earlierColumn - column) === row - earlierRow)
  }

  function place(row: number): boolean {
    if (row === size) {
      solved = true
      frame(null, [], `All ${size} queens are placed and none attack each other`)
      return true
    }
    for (let column = 0; column < size; column++) {
      const attackers = attackersOf(row, column)
      if (attackers.length > 0) {
        frame([row, column], attackers, `Row ${row + 1}, column ${column + 1}: attacked, try the next column`)
        continue
      }
      columns.push(column)
      frame([row, column], [], `Row ${row + 1}, column ${column + 1}: safe, place a queen`)
      if (place(row + 1)) return true
      columns.pop()
      frame(null, [], `Row ${row + 2} has no safe square: backtrack and move the queen in row ${row + 1}`)
    }
    return false
  }

  frame(null, [], `Place ${size} queens so that none attack another`)
  place(0)
  return frames
}
