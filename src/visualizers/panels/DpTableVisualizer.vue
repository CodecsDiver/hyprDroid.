<script setup lang="ts">
import { computed, inject, nextTick, watch } from 'vue'
import { LAB_REPLAY_KEY } from '../../lab/replay'
import { coinFrames, knapsackFrames, lcsFrames, type DpFrame } from '../algorithms/dp'
import PlayerControls from '../PlayerControls.vue'
import { useStepPlayer } from '../useStepPlayer'

const props = defineProps<{ kind: 'lcs' | 'knapsack' | 'coin' }>()

const TITLES = {
  lcs: { name: 'Longest common subsequence: ABCBDAB and BDCABA', complexity: 'O(n x m)' },
  knapsack: { name: 'Knapsack: best value for a bag of size 7', complexity: 'O(items x capacity)' },
  coin: { name: 'Coin change: fewest coins for 11 using 1, 5, 6, 9', complexity: 'O(amount x coins)' },
} as const

const player = useStepPlayer<DpFrame>(() => {
  if (props.kind === 'lcs') return lcsFrames('ABCBDAB', 'BDCABA')
  if (props.kind === 'knapsack') return knapsackFrames([1, 3, 4, 5], [1, 4, 5, 7], 7)
  return coinFrames([1, 5, 6, 9], 11)
})

const replayRequest = inject(LAB_REPLAY_KEY, null)
if (replayRequest) {
  watch(replayRequest, async () => {
    await nextTick()
    player.restart()
    player.play()
  })
}

const frame = computed(() => player.frame.value)
const show = (value: number | null) => (value === null ? '' : Number.isFinite(value) ? String(value) : '∞')
const isActive = (row: number, column: number) => frame.value.active?.[0] === row && frame.value.active?.[1] === column
const isRead = (row: number, column: number) => frame.value.reads.some(([r, c]) => r === row && c === column)
const isAnswer = (row: number, column: number) => frame.value.answer?.[0] === row && frame.value.answer?.[1] === column
</script>

<template>
  <div class="viz">
    <div class="toolbar">
      <strong class="name">{{ TITLES[kind].name }}</strong>
      <span class="complexity">{{ TITLES[kind].complexity }}</span>
    </div>

    <div class="scroller">
      <table class="table">
        <thead>
          <tr>
            <th class="corner" />
            <th v-for="(label, column) in frame.columnLabels" :key="column" class="col-head">{{ label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in frame.table" :key="rowIndex">
            <th class="row-head">{{ frame.rowLabels[rowIndex] }}</th>
            <td
              v-for="(value, column) in row"
              :key="column"
              class="cell"
              :class="{ active: isActive(rowIndex, column), read: isRead(rowIndex, column), answer: isAnswer(rowIndex, column), empty: value === null }"
            >{{ show(value) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="legend">
      <span><i class="swatch active" />being filled</span><span><i class="swatch read" />built from</span><span><i class="swatch answer" />answer</span>
    </div>
    <PlayerControls :player="player" :note="frame.note" />
  </div>
</template>

<style scoped>
.viz { display: flex; flex-direction: column; gap: 12px; height: 100%; }
.toolbar { display: flex; align-items: center; gap: 18px; }
.name { color: var(--neon-cyan); letter-spacing: 0.06em; }
.complexity { margin-left: auto; color: var(--neon-amber); font-weight: 700; }
.scroller { flex: 1; min-height: 200px; overflow: auto; background: rgb(var(--void-rgb) / 0.7); border: 1px solid rgb(var(--neon-cyan-rgb) / 0.2); padding: 12px; }
.table { border-collapse: separate; border-spacing: 3px; margin: 0 auto; }
.col-head, .row-head { font-size: 11px; color: var(--neon-violet); font-weight: 700; padding: 2px 8px; white-space: nowrap; }
.row-head { text-align: right; }
.cell { min-width: 38px; height: 34px; text-align: center; font-size: 15px; font-weight: 700; color: var(--text); background: rgb(var(--neon-cyan-rgb) / 0.07); border: 1px solid rgb(var(--neon-cyan-rgb) / 0.2); transition: background 0.15s, border-color 0.15s; }
.cell.empty { background: transparent; border-style: dashed; border-color: rgb(var(--text-dim-rgb) / 0.25); }
.cell.read { background: rgb(var(--neon-cyan-rgb) / 0.3); border-color: var(--neon-cyan); }
.cell.active { background: rgb(var(--neon-amber-rgb) / 0.4); border-color: var(--neon-amber); color: var(--flash); box-shadow: 0 0 calc(10px * var(--fx-scale)) var(--neon-amber); }
.cell.answer { background: rgb(var(--neon-green-rgb) / 0.4); border-color: var(--neon-green); color: var(--flash); box-shadow: 0 0 calc(12px * var(--fx-scale)) var(--neon-green); }
.legend { display: flex; gap: 16px; font-size: 11px; color: var(--text-dim); }
.legend span { display: flex; align-items: center; gap: 6px; }
.swatch { display: inline-block; width: 10px; height: 10px; border: 1px solid; }
.swatch.active { border-color: var(--neon-amber); background: rgb(var(--neon-amber-rgb) / 0.4); }
.swatch.read { border-color: var(--neon-cyan); background: rgb(var(--neon-cyan-rgb) / 0.3); }
.swatch.answer { border-color: var(--neon-green); background: rgb(var(--neon-green-rgb) / 0.4); }
</style>
