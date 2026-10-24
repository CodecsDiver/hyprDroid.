<script setup lang="ts">
import { computed, inject, nextTick, watch } from 'vue'
import { LAB_REPLAY_KEY } from '../../lab/replay'
import { dijkstraFrames, MORNING_GRAPH, ROAD_GRAPH, topologicalFrames, type GraphFrame } from '../algorithms/graph'
import PlayerControls from '../PlayerControls.vue'
import { useStepPlayer } from '../useStepPlayer'

const props = defineProps<{ mode: 'dijkstra' | 'topo' }>()

const graph = computed(() => (props.mode === 'dijkstra' ? ROAD_GRAPH : MORNING_GRAPH))
const player = useStepPlayer<GraphFrame>(() => (props.mode === 'dijkstra' ? dijkstraFrames(ROAD_GRAPH, 'A') : topologicalFrames(MORNING_GRAPH)))

const replayRequest = inject(LAB_REPLAY_KEY, null)
if (replayRequest) {
  watch(replayRequest, async () => {
    await nextTick()
    player.restart()
    player.play()
  })
}

const nodeById = computed(() => new Map(graph.value.nodes.map((node) => [node.id, node])))
const frame = computed(() => player.frame.value)
const isActiveEdge = (from: string, to: string) => frame.value.activeEdge?.[0] === from && frame.value.activeEdge?.[1] === to
const isChosenEdge = (from: string, to: string) => frame.value.chosenEdges.some(([a, b]) => a === from && b === to)

function nodeClass(id: string): string {
  if (frame.value.current === id) return 'current'
  if (frame.value.done.includes(id)) return 'done'
  if (frame.value.frontier.includes(id)) return 'frontier'
  return ''
}

/** Shortens an edge so its arrowhead stops at the edge of the node circle instead of its centre. */
function edgeLine(from: string, to: string): { x1: number; y1: number; x2: number; y2: number; mx: number; my: number } {
  const a = nodeById.value.get(from)!
  const b = nodeById.value.get(to)!
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  const inset = 6.2
  return { x1: a.x + (dx / length) * inset, y1: a.y + (dy / length) * inset, x2: b.x - (dx / length) * (inset + 1.2), y2: b.y - (dy / length) * (inset + 1.2), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
}
</script>

<template>
  <div class="viz">
    <div class="toolbar">
      <strong class="name">{{ mode === 'dijkstra' ? 'Dijkstra: shortest roads from A' : 'Topological sort: a valid order for the tasks' }}</strong>
      <span class="complexity">{{ mode === 'dijkstra' ? 'O((V + E) log V)' : 'O(V + E)' }}</span>
    </div>

    <svg class="graph" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Graph animation">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrow-head" /></marker>
      </defs>
      <g v-for="edge in graph.edges" :key="`${edge.from}-${edge.to}`">
        <line
          class="edge"
          :class="{ active: isActiveEdge(edge.from, edge.to), chosen: isChosenEdge(edge.from, edge.to) }"
          :x1="edgeLine(edge.from, edge.to).x1" :y1="edgeLine(edge.from, edge.to).y1"
          :x2="edgeLine(edge.from, edge.to).x2" :y2="edgeLine(edge.from, edge.to).y2"
          marker-end="url(#arrow)"
        />
        <text v-if="edge.weight !== undefined" class="weight" :x="edgeLine(edge.from, edge.to).mx" :y="edgeLine(edge.from, edge.to).my - 1.6">{{ edge.weight }}</text>
      </g>
      <g v-for="node in graph.nodes" :key="node.id" class="node" :class="nodeClass(node.id)">
        <circle :cx="node.x" :cy="node.y" r="5.6" />
        <text class="id" :x="node.x" :y="node.y + 1.3">{{ node.id.length > 2 ? node.id.slice(0, 2) : node.id }}</text>
        <text class="label" :x="node.x" :y="node.y + 10.5">{{ node.id.length > 2 ? node.id + ' · ' : '' }}{{ frame.labels[node.id] }}</text>
      </g>
    </svg>

    <div v-if="mode === 'topo'" class="order">
      <span class="order-title">ORDER</span>
      <span v-for="step in frame.order" :key="step" class="chip">{{ step }}</span>
      <span v-if="frame.order.length === 0" class="empty">nothing done yet</span>
    </div>
    <div class="legend">
      <span><i class="swatch current" />working on</span><span><i class="swatch frontier" />waiting</span><span><i class="swatch done" />final</span>
    </div>

    <PlayerControls :player="player" :note="frame.note" />
  </div>
</template>

<style scoped>
.viz { display: flex; flex-direction: column; gap: 10px; height: 100%; }
.toolbar { display: flex; align-items: center; gap: 18px; }
.name { color: var(--neon-cyan); letter-spacing: 0.08em; }
.complexity { margin-left: auto; color: var(--neon-amber); font-weight: 700; }
.graph { flex: 1; min-height: 220px; width: 100%; background: rgb(var(--void-rgb) / 0.7); border: 1px solid rgb(var(--neon-cyan-rgb) / 0.2); }
.edge { stroke: rgb(var(--text-dim-rgb) / 0.6); stroke-width: 0.5; transition: stroke 0.15s, stroke-width 0.15s; }
.edge.chosen { stroke: var(--neon-green); stroke-width: 0.9; }
.edge.active { stroke: var(--neon-amber); stroke-width: 1.2; filter: drop-shadow(0 0 1.2px var(--neon-amber)); }
.arrow-head { fill: rgb(var(--text-dim-rgb) / 0.9); }
.weight { fill: var(--neon-violet); font-size: 3.6px; font-weight: 700; text-anchor: middle; }
.node circle { fill: var(--hull-raised); stroke: var(--metal-light); stroke-width: 0.7; transition: fill 0.2s, stroke 0.2s; }
.node.frontier circle { stroke: var(--neon-cyan); fill: rgb(var(--neon-cyan-rgb) / 0.2); }
.node.done circle { stroke: var(--neon-green); fill: rgb(var(--neon-green-rgb) / 0.25); }
.node.current circle { stroke: var(--neon-amber); fill: rgb(var(--neon-amber-rgb) / 0.35); filter: drop-shadow(0 0 2px var(--neon-amber)); }
.id { fill: var(--text); font-size: 4px; font-weight: 800; text-anchor: middle; }
.label { fill: var(--neon-cyan); font-size: 3.4px; text-anchor: middle; }
.order { display: flex; align-items: center; gap: 8px; min-height: 28px; flex-wrap: wrap; }
.order-title { font-size: 10px; letter-spacing: 0.2em; color: var(--text-dim); }
.chip { padding: 2px 10px; border: 1px solid var(--neon-green); color: var(--neon-green); font-size: 12px; }
.empty { color: var(--text-dim); font-size: 12px; }
.legend { display: flex; gap: 16px; font-size: 11px; color: var(--text-dim); }
.legend span { display: flex; align-items: center; gap: 6px; }
.swatch { display: inline-block; width: 10px; height: 10px; border: 1px solid; }
.swatch.current { border-color: var(--neon-amber); background: rgb(var(--neon-amber-rgb) / 0.4); }
.swatch.frontier { border-color: var(--neon-cyan); background: rgb(var(--neon-cyan-rgb) / 0.25); }
.swatch.done { border-color: var(--neon-green); background: rgb(var(--neon-green-rgb) / 0.3); }
</style>
