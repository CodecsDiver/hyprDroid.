export interface GraphNode {
  id: string
  /** Position in a 0..100 box. */
  x: number
  y: number
}

export interface GraphEdge {
  from: string
  to: string
  weight?: number
}

export interface GraphDefinition {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphFrame {
  current: string | null
  /** Nodes whose answer is final. */
  done: string[]
  /** Nodes waiting in the queue. */
  frontier: string[]
  /** Small text shown beside each node: a distance or a count of unmet prerequisites. */
  labels: Record<string, string>
  /** The edge being looked at right now. */
  activeEdge: [string, string] | null
  /** Edges that gave a node its best answer so far. */
  chosenEdges: Array<[string, string]>
  /** For ordering algorithms: the output so far. */
  order: string[]
  note: string
}

export const ROAD_GRAPH: GraphDefinition = {
  nodes: [
    { id: 'A', x: 8, y: 50 },
    { id: 'B', x: 30, y: 16 },
    { id: 'C', x: 30, y: 84 },
    { id: 'D', x: 58, y: 34 },
    { id: 'E', x: 62, y: 78 },
    { id: 'F', x: 92, y: 50 },
  ],
  edges: [
    { from: 'A', to: 'B', weight: 4 },
    { from: 'A', to: 'C', weight: 2 },
    { from: 'B', to: 'C', weight: 1 },
    { from: 'B', to: 'D', weight: 5 },
    { from: 'C', to: 'D', weight: 8 },
    { from: 'C', to: 'E', weight: 10 },
    { from: 'D', to: 'E', weight: 2 },
    { from: 'D', to: 'F', weight: 6 },
    { from: 'E', to: 'F', weight: 3 },
  ],
}

export const MORNING_GRAPH: GraphDefinition = {
  nodes: [
    { id: 'wake', x: 10, y: 50 },
    { id: 'shower', x: 38, y: 18 },
    { id: 'coffee', x: 38, y: 82 },
    { id: 'dress', x: 66, y: 18 },
    { id: 'leave', x: 90, y: 50 },
  ],
  edges: [
    { from: 'wake', to: 'shower' },
    { from: 'wake', to: 'coffee' },
    { from: 'shower', to: 'dress' },
    { from: 'coffee', to: 'leave' },
    { from: 'dress', to: 'leave' },
  ],
}

const outgoing = (graph: GraphDefinition, id: string) => graph.edges.filter((edge) => edge.from === id)

/** Dijkstra: always finalize the closest unfinished node, then see whether it offers a shorter road to its neighbours. */
export function dijkstraFrames(graph: GraphDefinition, source: string): GraphFrame[] {
  const frames: GraphFrame[] = []
  const distance: Record<string, number> = Object.fromEntries(graph.nodes.map((node) => [node.id, Infinity]))
  const via: Record<string, string> = {}
  const done: string[] = []
  const queue: Array<{ cost: number; node: string }> = [{ cost: 0, node: source }]
  distance[source] = 0

  const labels = () => Object.fromEntries(graph.nodes.map((node) => [node.id, Number.isFinite(distance[node.id]) ? String(distance[node.id]) : '∞']))
  const chosen = (): Array<[string, string]> => Object.entries(via).map(([to, from]) => [from, to])
  const frame = (current: string | null, activeEdge: [string, string] | null, note: string) =>
    frames.push({ current, done: [...done], frontier: queue.map((entry) => entry.node), labels: labels(), activeEdge, chosenEdges: chosen(), order: [], note })

  frame(null, null, `Every distance starts at infinity, except ${source} which is 0`)
  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost)
    const { cost, node } = queue.shift()!
    if (cost > distance[node]) continue
    frame(node, null, `Take ${node}, the closest unfinished node (distance ${cost})`)
    for (const edge of outgoing(graph, node)) {
      const newCost = cost + (edge.weight ?? 1)
      const improves = newCost < distance[edge.to]
      if (improves) {
        distance[edge.to] = newCost
        via[edge.to] = node
        queue.push({ cost: newCost, node: edge.to })
      }
      frame(node, [node, edge.to], improves ? `${node} to ${edge.to}: ${newCost} beats the old distance, so update it` : `${node} to ${edge.to}: ${newCost} is not shorter, keep the old distance`)
    }
    done.push(node)
    frame(null, null, `${node} is final: the shortest distance is ${distance[node]}`)
  }
  frame(null, null, 'Every reachable node has its shortest distance')
  return frames
}

/** Kahn's algorithm: repeatedly take a task with no unmet prerequisites. */
export function topologicalFrames(graph: GraphDefinition): GraphFrame[] {
  const frames: GraphFrame[] = []
  const incoming: Record<string, number> = Object.fromEntries(graph.nodes.map((node) => [node.id, 0]))
  for (const edge of graph.edges) incoming[edge.to] += 1
  const ready = graph.nodes.map((node) => node.id).filter((id) => incoming[id] === 0).sort()
  const order: string[] = []

  const labels = () => Object.fromEntries(graph.nodes.map((node) => [node.id, String(incoming[node.id])]))
  const frame = (current: string | null, activeEdge: [string, string] | null, note: string) =>
    frames.push({ current, done: [...order], frontier: [...ready], labels: labels(), activeEdge, chosenEdges: [], order: [...order], note })

  frame(null, null, 'The number by each task is how many tasks it still waits for')
  while (ready.length > 0) {
    const node = ready.shift()!
    order.push(node)
    frame(node, null, `${node} waits for nothing: do it next`)
    for (const edge of outgoing(graph, node)) {
      incoming[edge.to] -= 1
      if (incoming[edge.to] === 0) ready.push(edge.to)
      frame(node, [node, edge.to], incoming[edge.to] === 0 ? `${edge.to} has no more prerequisites: it is ready` : `${edge.to} now waits for ${incoming[edge.to]} more`)
    }
  }
  frame(null, null, order.length === graph.nodes.length ? `Done: ${order.join(' then ')}` : 'A loop of dependencies: no valid order exists')
  return frames
}
