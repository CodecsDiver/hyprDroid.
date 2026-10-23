export interface SortFrame {
  values: number[]
  /** Indices currently being compared or written. */
  active: number[]
  /** Indices known to be in their final position. */
  settled: number[]
  note: string
}

export type SortAlgorithmId = 'bubble' | 'insertion' | 'selection' | 'quick' | 'merge'

export const SORT_ALGORITHMS: ReadonlyArray<{ id: SortAlgorithmId; label: string; complexity: string }> = [
  { id: 'bubble', label: 'Bubble sort', complexity: 'O(n^2)' },
  { id: 'insertion', label: 'Insertion sort', complexity: 'O(n^2)' },
  { id: 'selection', label: 'Selection sort', complexity: 'O(n^2)' },
  { id: 'quick', label: 'Quick sort', complexity: 'O(n log n) average' },
  { id: 'merge', label: 'Merge sort', complexity: 'O(n log n)' },
]

const snapshot = (values: number[], active: number[], settled: Iterable<number>, note: string): SortFrame => ({
  values: [...values],
  active,
  settled: [...settled],
  note,
})

function* bubbleSort(input: number[]): Generator<SortFrame> {
  const values = [...input]
  const settled = new Set<number>()
  for (let pass = 0; pass < values.length - 1; pass++) {
    for (let index = 0; index < values.length - 1 - pass; index++) {
      yield snapshot(values, [index, index + 1], settled, `Compare ${values[index]} and ${values[index + 1]}`)
      if (values[index] > values[index + 1]) {
        ;[values[index], values[index + 1]] = [values[index + 1], values[index]]
        yield snapshot(values, [index, index + 1], settled, 'Out of order: swap them')
      }
    }
    settled.add(values.length - 1 - pass)
  }
  values.forEach((_, index) => settled.add(index))
  yield snapshot(values, [], settled, 'Sorted')
}

function* insertionSort(input: number[]): Generator<SortFrame> {
  const values = [...input]
  for (let current = 1; current < values.length; current++) {
    let index = current
    yield snapshot(values, [index], [], `Take ${values[index]} and slide it left into place`)
    while (index > 0 && values[index - 1] > values[index]) {
      ;[values[index - 1], values[index]] = [values[index], values[index - 1]]
      index--
      yield snapshot(values, [index, index + 1], [], 'Shift past a larger value')
    }
  }
  yield snapshot(values, [], values.keys(), 'Sorted')
}

function* selectionSort(input: number[]): Generator<SortFrame> {
  const values = [...input]
  const settled = new Set<number>()
  for (let start = 0; start < values.length - 1; start++) {
    let smallest = start
    for (let index = start + 1; index < values.length; index++) {
      yield snapshot(values, [smallest, index], settled, `Looking for the smallest: ${values[smallest]} vs ${values[index]}`)
      if (values[index] < values[smallest]) smallest = index
    }
    if (smallest !== start) {
      ;[values[start], values[smallest]] = [values[smallest], values[start]]
      yield snapshot(values, [start, smallest], settled, `Place ${values[start]} at position ${start}`)
    }
    settled.add(start)
  }
  values.forEach((_, index) => settled.add(index))
  yield snapshot(values, [], settled, 'Sorted')
}

function* quickSort(input: number[]): Generator<SortFrame> {
  const values = [...input]
  const settled = new Set<number>()

  function* partition(low: number, high: number): Generator<SortFrame, number> {
    const pivot = values[high]
    let boundary = low
    for (let index = low; index < high; index++) {
      yield snapshot(values, [index, high], settled, `Compare ${values[index]} with pivot ${pivot}`)
      if (values[index] < pivot) {
        ;[values[index], values[boundary]] = [values[boundary], values[index]]
        if (index !== boundary) yield snapshot(values, [index, boundary], settled, 'Move smaller value left of the boundary')
        boundary++
      }
    }
    ;[values[boundary], values[high]] = [values[high], values[boundary]]
    settled.add(boundary)
    yield snapshot(values, [boundary], settled, `Pivot ${pivot} is now in its final place`)
    return boundary
  }

  function* sort(low: number, high: number): Generator<SortFrame> {
    if (low > high) return
    if (low === high) {
      settled.add(low)
      return
    }
    const pivotIndex = yield* partition(low, high)
    yield* sort(low, pivotIndex - 1)
    yield* sort(pivotIndex + 1, high)
  }

  yield* sort(0, values.length - 1)
  yield snapshot(values, [], values.keys(), 'Sorted')
}

function* mergeSort(input: number[]): Generator<SortFrame> {
  const values = [...input]

  function* sort(low: number, high: number): Generator<SortFrame> {
    if (low >= high) return
    const middle = Math.floor((low + high) / 2)
    yield* sort(low, middle)
    yield* sort(middle + 1, high)

    const left = values.slice(low, middle + 1)
    const right = values.slice(middle + 1, high + 1)
    let leftIndex = 0
    let rightIndex = 0
    for (let write = low; write <= high; write++) {
      const takeLeft = rightIndex >= right.length || (leftIndex < left.length && left[leftIndex] <= right[rightIndex])
      values[write] = takeLeft ? left[leftIndex++] : right[rightIndex++]
      yield snapshot(values, [write], [], `Merge ${low}..${high}: write ${values[write]}`)
    }
  }

  yield* sort(0, values.length - 1)
  yield snapshot(values, [], values.keys(), 'Sorted')
}

export function sortFrames(algorithm: SortAlgorithmId, input: number[]): SortFrame[] {
  const generators: Record<SortAlgorithmId, (values: number[]) => Generator<SortFrame>> = {
    bubble: bubbleSort,
    insertion: insertionSort,
    selection: selectionSort,
    quick: quickSort,
    merge: mergeSort,
  }
  return [snapshot(input, [], [], 'Unsorted input'), ...generators[algorithm](input)]
}

export function randomValues(count: number, random: () => number = Math.random): number[] {
  return Array.from({ length: count }, () => 5 + Math.floor(random() * 95))
}
