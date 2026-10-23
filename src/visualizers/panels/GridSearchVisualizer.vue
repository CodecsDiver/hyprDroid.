<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { gridSearchFrames, pointKey, type GridSearchKind } from '../algorithms/gridSearch'
import PlayerControls from '../PlayerControls.vue'
import { useStepPlayer } from '../useStepPlayer'

const ROWS = 10
const COLUMNS = 18
const start = { row: 1, column: 1 }
const goal = { row: 8, column: 16 }

const props = defineProps<{ fixedKind?: GridSearchKind }>()
const kind = ref<GridSearchKind>(props.fixedKind ?? 'bfs')
watch(() => props.fixedKind, (next) => next && (kind.value = next))
const walls = ref(new Set<string>(
  Array.from({ length: 7 }, (_, row) => `${row + 1},9`).concat(Array.from({ length: 5 }, (_, row) => `${row + 4},5`)),
))

const player = useStepPlayer(() => gridSearchFrames(kind.value, ROWS, COLUMNS, walls.value, start, goal))

const visitedSet = computed(() => new Set(player.frame.value.visited))
const frontierSet = computed(() => new Set(player.frame.value.frontier))
const pathSet = computed(() => new Set(player.frame.value.path ?? []))
const cells = computed(() =>
  Array.from({ length: ROWS * COLUMNS }, (_, index) => ({ row: Math.floor(index / COLUMNS), column: index % COLUMNS })),
)

function toggleWall(row: number, column: number): void {
  const key = pointKey({ row, column })
  if (key === pointKey(start) || key === pointKey(goal)) return
  const next = new Set(walls.value)
  if (!next.delete(key)) next.add(key)
  walls.value = next
}

function cellClass(row: number, column: number): string {
  const key = pointKey({ row, column })
  if (key === pointKey(start)) return 'start'
  if (key === pointKey(goal)) return 'goal'
  if (walls.value.has(key)) return 'wall'
  if (pathSet.value.has(key)) return 'path'
  if (player.frame.value.current === key) return 'current'
  if (frontierSet.value.has(key)) return 'frontier'
  if (visitedSet.value.has(key)) return 'visited'
  return ''
}
</script>

<template>
  <div class="viz">
    <div class="toolbar">
      <div v-if="!fixedKind" class="segments">
        <button class="segment" :class="{ on: kind === 'bfs' }" @click="kind = 'bfs'">BFS &middot; queue</button>
        <button class="segment" :class="{ on: kind === 'dfs' }" @click="kind = 'dfs'">DFS &middot; stack</button>
      </div>
      <strong v-if="fixedKind" class="kind-name">{{ kind === 'bfs' ? 'BFS · queue' : 'DFS · stack' }}</strong>
      <span class="hint">Click cells to build walls, then press Play.</span>
    </div>

    <div class="grid" :style="{ gridTemplateColumns: `repeat(${COLUMNS}, 1fr)` }">
      <div
        v-for="cell in cells"
        :key="`${cell.row},${cell.column}`"
        class="cell"
        :class="cellClass(cell.row, cell.column)"
        @click="toggleWall(cell.row, cell.column)"
      />
    </div>

    <div class="legend">
      <span><i class="swatch start" />start</span><span><i class="swatch goal" />goal</span>
      <span><i class="swatch frontier" />waiting</span><span><i class="swatch visited" />visited</span><span><i class="swatch path" />path</span>
    </div>

    <PlayerControls :player="player" :note="player.frame.value.note" />
  </div>
</template>

<style scoped>
.viz { display: flex; flex-direction: column; gap: 14px; }
.toolbar { display: flex; align-items: center; gap: 18px; }
.segments { display: flex; }
.segment { padding: 8px 16px; cursor: pointer; background: transparent; border: 1px solid rgba(113, 134, 160, 0.4); color: var(--text-dim); font-size: 11px; letter-spacing: 0.1em; }
.segment.on { color: var(--void); background: var(--neon-cyan); border-color: var(--neon-cyan); box-shadow: var(--glow-cyan); }
.hint { color: var(--text-dim); font-size: 12px; }
.kind-name { color: var(--neon-cyan); letter-spacing: 0.1em; }
.grid { display: grid; gap: 2px; padding: 10px; max-width: 760px; background: rgba(4, 5, 10, 0.7); border: 1px solid rgba(25, 230, 255, 0.2); }
.cell { aspect-ratio: 1; background: rgba(255, 255, 255, 0.04); cursor: pointer; transition: background 0.15s, transform 0.15s; }
.cell:hover { background: rgba(255, 255, 255, 0.12); }
.cell.wall { background: #2a3350; box-shadow: inset 0 0 0 1px var(--metal-light); }
.cell.visited { background: rgba(164, 92, 255, 0.45); }
.cell.frontier { background: rgba(255, 200, 61, 0.55); }
.cell.current { background: #fff; transform: scale(1.15); box-shadow: 0 0 calc(12px * var(--fx-scale)) #fff; }
.cell.path { background: var(--neon-green); box-shadow: var(--glow-green); }
.cell.start { background: var(--neon-cyan); box-shadow: var(--glow-cyan); }
.cell.goal { background: var(--neon-red); box-shadow: var(--glow-red); }
.legend { display: flex; gap: 18px; font-size: 11px; color: var(--text-dim); }
.legend span { display: flex; align-items: center; gap: 6px; }
.swatch { width: 12px; height: 12px; display: inline-block; }
.swatch.start { background: var(--neon-cyan); }
.swatch.goal { background: var(--neon-red); }
.swatch.frontier { background: rgba(255, 200, 61, 0.7); }
.swatch.visited { background: rgba(164, 92, 255, 0.6); }
.swatch.path { background: var(--neon-green); }
</style>
