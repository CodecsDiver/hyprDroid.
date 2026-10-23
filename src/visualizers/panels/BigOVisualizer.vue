<script setup lang="ts">
import { computed, ref } from 'vue'

const inputSize = ref(10)

const CHART_WIDTH = 640
const CHART_HEIGHT = 300
const MAX_OPERATIONS = 400
const MAX_N = 30

interface Curve {
  label: string
  example: string
  color: string
  operations: (n: number) => number
}

const curves: Curve[] = [
  { label: 'O(1)', example: 'dict lookup', color: 'var(--neon-green)', operations: () => 1 },
  { label: 'O(log n)', example: 'binary search', color: 'var(--neon-cyan)', operations: (n) => Math.log2(Math.max(n, 1)) },
  { label: 'O(n)', example: 'loop over a list', color: 'var(--neon-violet)', operations: (n) => n },
  { label: 'O(n log n)', example: 'merge sort', color: 'var(--neon-amber)', operations: (n) => n * Math.log2(Math.max(n, 1)) },
  { label: 'O(n^2)', example: 'nested loops', color: '#ff7a3d', operations: (n) => n * n },
  { label: 'O(2^n)', example: 'naive fib', color: 'var(--neon-red)', operations: (n) => Math.pow(2, n) },
]

const x = (n: number) => (n / MAX_N) * CHART_WIDTH
const y = (operations: number) => CHART_HEIGHT - Math.min(operations / MAX_OPERATIONS, 1) * CHART_HEIGHT

const paths = computed(() =>
  curves.map((curve) => ({
    curve,
    d: Array.from({ length: MAX_N + 1 }, (_, n) => `${n === 0 ? 'M' : 'L'}${x(n).toFixed(1)},${y(curve.operations(n)).toFixed(1)}`).join(' '),
    atN: curve.operations(inputSize.value),
  })),
)
</script>

<template>
  <div class="viz">
    <div class="toolbar">
      <label>INPUT SIZE n = <b>{{ inputSize }}</b> <input v-model.number="inputSize" type="range" min="1" max="30" /></label>
    </div>

    <div class="stage">
      <svg :viewBox="`-10 -10 ${CHART_WIDTH + 20} ${CHART_HEIGHT + 20}`" class="chart">
        <line v-for="tick in 5" :key="tick" :x1="0" :x2="CHART_WIDTH" :y1="(CHART_HEIGHT / 5) * tick" :y2="(CHART_HEIGHT / 5) * tick" class="gridline" />
        <path v-for="entry in paths" :key="entry.curve.label" :d="entry.d" :stroke="entry.curve.color" class="curve" />
        <line :x1="x(inputSize)" :x2="x(inputSize)" y1="0" :y2="CHART_HEIGHT" class="marker" />
        <circle v-for="entry in paths" :key="`dot-${entry.curve.label}`" :cx="x(inputSize)" :cy="y(entry.atN)" r="5" :fill="entry.curve.color" />
      </svg>
      <ul class="table">
        <li v-for="entry in paths" :key="entry.curve.label">
          <i :style="{ background: entry.curve.color }" />
          <span class="name">{{ entry.curve.label }}</span>
          <span class="example">{{ entry.curve.example }}</span>
          <span class="ops">{{ Math.round(entry.atN).toLocaleString() }} ops</span>
        </li>
      </ul>
    </div>
    <p class="insight">Drag n upward: the red curve leaves the chart almost immediately. That is why O(2^n) code stops being usable around n = 40.</p>
  </div>
</template>

<style scoped>
.viz { display: flex; flex-direction: column; gap: 14px; }
.toolbar label { display: flex; align-items: center; gap: 12px; font-size: 11px; letter-spacing: 0.15em; color: var(--text-dim); }
b { color: var(--neon-cyan); font-size: 16px; }
input[type='range'] { accent-color: var(--neon-violet); width: 280px; }
.stage { display: grid; grid-template-columns: 1fr 280px; gap: 18px; align-items: start; padding: 16px; background: rgba(4, 5, 10, 0.7); border: 1px solid rgba(25, 230, 255, 0.2); }
.chart { width: 100%; overflow: visible; }
.gridline { stroke: rgba(255, 255, 255, 0.07); }
.curve { fill: none; stroke-width: 2.5; }
.marker { stroke: rgba(255, 255, 255, 0.5); stroke-dasharray: 4 4; }
.table { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.table li { display: grid; grid-template-columns: 10px 1fr auto; column-gap: 10px; align-items: center; }
.table i { width: 10px; height: 10px; grid-row: span 2; }
.name { font-weight: 700; }
.example { grid-column: 2; font-size: 11px; color: var(--text-dim); }
.ops { grid-row: span 2; grid-column: 3; color: var(--neon-amber); }
.insight { margin: 0; font-size: 12px; color: var(--text-dim); line-height: 1.5; }
</style>
