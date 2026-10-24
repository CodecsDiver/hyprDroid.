export interface DpFrame {
  /** null = not filled yet. Infinity is shown as an infinity sign. */
  table: Array<Array<number | null>>
  rowLabels: string[]
  columnLabels: string[]
  active: [number, number] | null
  /** The earlier cells this answer is built from. */
  reads: Array<[number, number]>
  /** The final answer cell, highlighted at the end. */
  answer: [number, number] | null
  note: string
}

const copyTable = (table: Array<Array<number | null>>) => table.map((row) => [...row])

/** Longest common subsequence: each cell is the best answer for a prefix of each word. */
export function lcsFrames(first: string, second: string): DpFrame[] {
  const rowLabels = ['', ...first]
  const columnLabels = ['', ...second]
  const table: Array<Array<number | null>> = rowLabels.map((_, row) => columnLabels.map((__, column) => (row === 0 || column === 0 ? 0 : null)))
  const frames: DpFrame[] = []
  const frame = (active: [number, number] | null, reads: Array<[number, number]>, note: string, answer: [number, number] | null = null) =>
    frames.push({ table: copyTable(table), rowLabels, columnLabels, active, reads, answer, note })

  frame(null, [], 'Empty prefixes share nothing, so the first row and column are 0')
  for (let i = 1; i <= first.length; i++) {
    for (let j = 1; j <= second.length; j++) {
      if (first[i - 1] === second[j - 1]) {
        table[i][j] = (table[i - 1][j - 1] as number) + 1
        frame([i, j], [[i - 1, j - 1]], `"${first[i - 1]}" matches "${second[j - 1]}": one more than the diagonal cell, ${table[i][j]}`)
      } else {
        table[i][j] = Math.max(table[i - 1][j] as number, table[i][j - 1] as number)
        frame([i, j], [[i - 1, j], [i, j - 1]], `"${first[i - 1]}" and "${second[j - 1]}" differ: take the larger of the cell above and the cell to the left, ${table[i][j]}`)
      }
    }
  }
  frame(null, [], `The longest common subsequence has length ${table[first.length][second.length]}`, [first.length, second.length])
  return frames
}

/** 0/1 knapsack: row i shows the best value using only the first i items. */
export function knapsackFrames(weights: number[], values: number[], capacity: number): DpFrame[] {
  const rowLabels = ['no items', ...weights.map((weight, index) => `weight ${weight}, value ${values[index]}`)]
  const columnLabels = Array.from({ length: capacity + 1 }, (_, index) => String(index))
  const table: Array<Array<number | null>> = rowLabels.map((_, row) => columnLabels.map(() => (row === 0 ? 0 : null)))
  const frames: DpFrame[] = []
  const frame = (active: [number, number] | null, reads: Array<[number, number]>, note: string, answer: [number, number] | null = null) =>
    frames.push({ table: copyTable(table), rowLabels, columnLabels, active, reads, answer, note })

  frame(null, [], 'With no items, every bag size holds value 0')
  for (let item = 1; item <= weights.length; item++) {
    const weight = weights[item - 1]
    const value = values[item - 1]
    for (let room = 0; room <= capacity; room++) table[item][room] = table[item - 1][room]
    frame(null, [], `Now allow item ${item} (weight ${weight}, value ${value}): start from the row above`)
    for (let room = capacity; room >= weight; room--) {
      const skip = table[item - 1][room] as number
      const take = (table[item - 1][room - weight] as number) + value
      table[item][room] = Math.max(skip, take)
      frame([item, room], [[item - 1, room], [item - 1, room - weight]], `Bag size ${room}: skip it (${skip}) or take it (${take - value} + ${value} = ${take}). Best: ${table[item][room]}`)
    }
  }
  frame(null, [], `The best value that fits a bag of size ${capacity} is ${table[weights.length][capacity]}`, [weights.length, capacity])
  return frames
}

/** Fewest coins for every amount up to the target, built from smaller amounts. */
export function coinFrames(coins: number[], amount: number): DpFrame[] {
  const columnLabels = Array.from({ length: amount + 1 }, (_, index) => String(index))
  const table: Array<Array<number | null>> = [columnLabels.map((_, index) => (index === 0 ? 0 : Infinity))]
  const frames: DpFrame[] = []
  const frame = (active: [number, number] | null, reads: Array<[number, number]>, note: string, answer: [number, number] | null = null) =>
    frames.push({ table: copyTable(table), rowLabels: ['fewest coins'], columnLabels, active, reads, answer, note })

  frame(null, [], 'Zero coins make amount 0. Every other amount starts as impossible (infinity)')
  for (let total = 1; total <= amount; total++) {
    for (const coin of coins) {
      if (coin > total) continue
      const candidate = (table[0][total - coin] as number) + 1
      const improves = candidate < (table[0][total] as number)
      if (improves) table[0][total] = candidate
      frame([0, total], [[0, total - coin]], improves ? `Amount ${total}: use a ${coin} coin on top of the answer for ${total - coin}, so ${candidate} coin(s)` : `Amount ${total}: a ${coin} coin would need ${candidate}, which is no better`)
    }
  }
  const best = table[0][amount] as number
  frame(null, [], Number.isFinite(best) ? `${amount} needs at least ${best} coin(s)` : `${amount} cannot be made with these coins`, [0, amount])
  return frames
}
