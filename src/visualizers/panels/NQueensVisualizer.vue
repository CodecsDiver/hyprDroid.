<script setup lang="ts">
import { computed, inject, nextTick, watch } from 'vue'
import { LAB_REPLAY_KEY } from '../../lab/replay'
import { queensFrames, type QueensFrame } from '../algorithms/nqueens'
import PlayerControls from '../PlayerControls.vue'
import { useStepPlayer } from '../useStepPlayer'

const SIZE = 6
const player = useStepPlayer<QueensFrame>(() => queensFrames(SIZE))

const replayRequest = inject(LAB_REPLAY_KEY, null)
if (replayRequest) {
  watch(replayRequest, async () => {
    await nextTick()
    player.restart()
    player.play()
  })
}

const frame = computed(() => player.frame.value)
const squares = computed(() => Array.from({ length: SIZE * SIZE }, (_, index) => ({ row: Math.floor(index / SIZE), column: index % SIZE })))
const hasQueen = (row: number, column: number) => frame.value.queens[row] === column
const isTrying = (row: number, column: number) => frame.value.trying?.[0] === row && frame.value.trying?.[1] === column
const isAttacker = (row: number, column: number) => frame.value.attackers.some(([r, c]) => r === row && c === column)
</script>

<template>
  <div class="viz">
    <div class="toolbar">
      <strong class="name">N-Queens: place 6 queens so none attack each other</strong>
      <span class="complexity">backtracking</span>
    </div>
    <div class="stage">
      <div class="board" :style="{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }">
        <div
          v-for="square in squares"
          :key="`${square.row},${square.column}`"
          class="square"
          :class="{
            dark: (square.row + square.column) % 2 === 1,
            queen: hasQueen(square.row, square.column),
            trying: isTrying(square.row, square.column),
            attacker: isAttacker(square.row, square.column),
            solved: frame.solved && hasQueen(square.row, square.column),
          }"
        ><span v-if="hasQueen(square.row, square.column)">&#9819;</span><span v-else-if="isTrying(square.row, square.column)" class="ghost">&#9819;</span></div>
      </div>
      <div class="side">
        <div class="stat">Queens placed <b>{{ frame.queens.length }}</b> / {{ SIZE }}</div>
        <div class="stat">Moves tried <b>{{ player.frameIndex.value }}</b></div>
        <p class="tip">Amber is the square being tried. Red squares hold queens that attack it. When a row has no safe square, the last queen steps back and moves on.</p>
      </div>
    </div>
    <PlayerControls :player="player" :note="frame.note" />
  </div>
</template>

<style scoped>
.viz { display: flex; flex-direction: column; gap: 12px; height: 100%; }
.toolbar { display: flex; align-items: center; gap: 18px; }
.name { color: var(--neon-cyan); letter-spacing: 0.06em; }
.complexity { margin-left: auto; color: var(--neon-amber); font-weight: 700; }
.stage { flex: 1; min-height: 240px; display: flex; gap: 28px; align-items: center; justify-content: center; }
.board { display: grid; width: min(340px, 44vh); aspect-ratio: 1; border: 2px solid var(--metal-light); }
.square { display: grid; place-items: center; font-size: clamp(20px, 4.4vh, 38px); background: rgb(var(--neon-cyan-rgb) / 0.06); transition: background 0.12s; position: relative; }
.square.dark { background: rgb(var(--neon-violet-rgb) / 0.14); }
.square.queen { color: var(--neon-green); text-shadow: var(--glow-green); }
.square.solved { color: var(--neon-amber); text-shadow: 0 0 calc(14px * var(--fx-scale)) var(--neon-amber); }
.square.trying { background: rgb(var(--neon-amber-rgb) / 0.35); box-shadow: inset 0 0 0 2px var(--neon-amber); }
.square.attacker { background: rgb(var(--neon-red-rgb) / 0.35); box-shadow: inset 0 0 0 2px var(--neon-red); }
.ghost { opacity: 0.45; color: var(--neon-amber); }
.side { max-width: 260px; display: flex; flex-direction: column; gap: 10px; }
.stat { font-size: 13px; color: var(--text-dim); }
.stat b { color: var(--neon-cyan); font-family: var(--font-display); font-size: 18px; }
.tip { margin: 6px 0 0; font-size: 12px; line-height: 1.6; color: var(--text-dim); }
</style>
