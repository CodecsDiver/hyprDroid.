export interface BinarySearchFrame {
  low: number
  high: number
  middle: number | null
  foundIndex: number | null
  /** Number of comparisons made so far. */
  steps: number
  note: string
}

export function binarySearchFrames(sortedValues: number[], target: number): BinarySearchFrame[] {
  const frames: BinarySearchFrame[] = []
  let low = 0
  let high = sortedValues.length - 1
  let steps = 0
  frames.push({ low, high, middle: null, foundIndex: null, steps, note: `Search for ${target} in ${sortedValues.length} sorted values` })

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    steps++
    const value = sortedValues[middle]
    if (value === target) {
      frames.push({ low, high, middle, foundIndex: middle, steps, note: `values[${middle}] = ${value}. Found it!` })
      return frames
    }
    if (value < target) {
      frames.push({ low, high, middle, foundIndex: null, steps, note: `${value} < ${target}: discard the left half` })
      low = middle + 1
    } else {
      frames.push({ low, high, middle, foundIndex: null, steps, note: `${value} > ${target}: discard the right half` })
      high = middle - 1
    }
  }
  frames.push({ low, high, middle: null, foundIndex: null, steps, note: `${target} is not in the list` })
  return frames
}
