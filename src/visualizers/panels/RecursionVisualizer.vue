<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue'
import { LAB_REPLAY_KEY } from '../../lab/replay'
import { fibonacciFrames, type CallNode } from '../algorithms/recursion'
import PlayerControls from '../PlayerControls.vue'
import { useStepPlayer } from '../useStepPlayer'

const n = ref(5)
const frames = computed(() => fibonacciFrames(n.value))
const player = useStepPlayer(() => frames.value)

const replayRequest = inject(LAB_REPLAY_KEY, null)
if (replayRequest) {
  watch(replayRequest, async () => {
    await nextTick()
    player.restart()
    player.play()
  })
}

const NODE_SPACING_X = 56
const NODE_SPACING_Y = 62
const PADDING = 34

/** Final-tree layout: leaves get consecutive x slots, parents sit centred over their children. */
const layout = computed(() => {
  const nodes = frames.value.at(-1)!.nodes
  const children = new Map<number, number[]>()
  nodes.forEach((node) => {
    if (node.parentId !== null) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id])
  })
  const positions = new Map<number, { x: number; y: number }>()
  let nextLeafSlot = 0
  const place = (node: CallNode): number => {
    const childIds = children.get(node.id) ?? []
    const x = childIds.length === 0 ? nextLeafSlot++ : childIds.map((id) => place(nodes[id])).reduce((a, b) => a + b, 0) / childIds.length
    positions.set(node.id, { x: x * NODE_SPACING_X + PADDING, y: node.depth * NODE_SPACING_Y + PADDING })
    return x
  }
  place(nodes[0])
  return {
    positions,
    width: nextLeafSlot * NODE_SPACING_X + PADDING,
    height: (Math.max(...nodes.map((node) => node.depth)) + 1) * NODE_SPACING_Y + PADDING,
  }
})

const visibleNodes = computed(() => player.frame.value.nodes)
const callsSoFar = computed(() => visibleNodes.value.length)
const totalCalls = computed(() => frames.value.at(-1)!.nodes.length)
</script>

<template>
  <div class="viz">
    <div class="toolbar">
      <label>fib(n), n = <b>{{ n }}</b> <input v-model.number="n" type="range" min="2" max="7" /></label>
      <span class="counter">calls so far: <b>{{ callsSoFar }}</b> of {{ totalCalls }} &middot; result: <b>{{ frames.at(-1)!.nodes[0].result }}</b></span>
    </div>

    <div class="stage">
      <svg :viewBox="`0 0 ${layout.width} ${layout.height}`" :width="layout.width" :height="layout.height">
        <g>
          <template v-for="node in visibleNodes" :key="`edge-${node.id}`">
            <line
              v-if="node.parentId !== null"
              :x1="layout.positions.get(node.parentId)!.x"
              :y1="layout.positions.get(node.parentId)!.y"
              :x2="layout.positions.get(node.id)!.x"
              :y2="layout.positions.get(node.id)!.y"
              class="edge"
            />
          </template>
        </g>
        <g v-for="node in visibleNodes" :key="node.id" :transform="`translate(${layout.positions.get(node.id)!.x}, ${layout.positions.get(node.id)!.y})`">
          <circle r="21" class="node" :class="[node.status, { active: player.frame.value.activeId === node.id }]" />
          <text class="label" y="-2">{{ node.argument }}</text>
          <text class="result" y="12">{{ node.result ?? '' }}</text>
        </g>
      </svg>
    </div>
    <p class="insight">Count the repeats: fib(2) is recomputed many times. That repeated work is why naive recursion explodes, and why memoization exists.</p>

    <PlayerControls :player="player" :note="player.frame.value.note" />
  </div>
</template>

<style scoped>
.viz { display: flex; flex-direction: column; gap: 14px; }
.toolbar { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.toolbar label { display: flex; align-items: center; gap: 10px; color: var(--text-dim); }
.toolbar b { color: var(--neon-cyan); }
input[type='range'] { accent-color: var(--neon-violet); }
.counter { margin-left: auto; color: var(--text-dim); }
.counter b { color: var(--neon-green); }
.stage { overflow: auto; max-height: 380px; padding: 8px; background: rgb(var(--void-rgb) / 0.7); border: 1px solid rgb(var(--neon-cyan-rgb) / 0.2); text-align: center; }
.edge { stroke: rgb(var(--neon-cyan-rgb) / 0.4); stroke-width: 1.5; }
.node { fill: var(--hull-raised); stroke: var(--metal-light); stroke-width: 2; transition: fill 0.2s, stroke 0.2s; }
.node.active { stroke: var(--neon-amber); fill: rgb(var(--neon-amber-rgb) / 0.22); }
.node.done { stroke: var(--neon-green); fill: rgb(var(--neon-green-rgb) / 0.14); }
.node.active.done { stroke: var(--neon-amber); }
.label { fill: var(--text); font-size: 12px; font-weight: 700; text-anchor: middle; }
.result { fill: var(--neon-green); font-size: 10px; text-anchor: middle; }
.insight { margin: 0; color: var(--text-dim); font-size: 12px; line-height: 1.5; }
</style>
