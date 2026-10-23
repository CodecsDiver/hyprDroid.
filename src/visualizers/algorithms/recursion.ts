export interface CallNode {
  id: number
  parentId: number | null
  argument: number
  depth: number
  status: 'waiting' | 'active' | 'done'
  result: number | null
}

export interface RecursionFrame {
  nodes: CallNode[]
  activeId: number | null
  note: string
}

/** Records every call of the naive recursive fib(n), including the repeated work. */
export function fibonacciFrames(n: number): RecursionFrame[] {
  const nodes: CallNode[] = []
  const frames: RecursionFrame[] = []
  const frame = (activeId: number | null, note: string) =>
    frames.push({ nodes: nodes.map((node) => ({ ...node })), activeId, note })

  function call(argument: number, parentId: number | null, depth: number): number {
    const node: CallNode = { id: nodes.length, parentId, argument, depth, status: 'active', result: null }
    nodes.push(node)
    frame(node.id, `fib(${argument}) is called`)
    let result: number
    if (argument < 2) {
      result = argument
      frame(node.id, `Base case: fib(${argument}) = ${argument}`)
    } else {
      const left = call(argument - 1, node.id, depth + 1)
      node.status = 'active'
      const right = call(argument - 2, node.id, depth + 1)
      node.status = 'active'
      result = left + right
      frame(node.id, `fib(${argument}) = ${left} + ${right} = ${result}`)
    }
    node.status = 'done'
    node.result = result
    frame(node.id, `fib(${argument}) returns ${result}`)
    return result
  }

  call(n, null, 0)
  return frames
}
