<script setup lang="ts">
import CountdownBanner from '../shell/CountdownBanner.vue'

defineProps<{
  title: string
  subtitle: string
  /** e.g. "Round 2 of 3" */
  roundLabel?: string
  /** Which rounds are won (true), lost (false) or still to come (null). */
  rounds?: Array<boolean | null>
  countdown: boolean
}>()
const emit = defineEmits<{ go: []; exit: [] }>()
</script>

<template>
  <div class="match">
    <header class="top">
      <div class="heading">
        <span class="title">{{ title }}</span>
        <span class="subtitle">{{ subtitle }}</span>
      </div>
      <div v-if="rounds" class="pips" :title="roundLabel">
        <i v-for="(result, index) in rounds" :key="index" :class="{ won: result === true, lost: result === false }" />
        <span class="round-label">{{ roundLabel }}</span>
      </div>
      <div class="clock"><slot name="clock" /></div>
      <button class="btn is-ghost" @click="emit('exit')">Leave</button>
    </header>
    <div class="lanes"><slot name="lanes" /></div>
    <div class="arena">
      <slot />
      <CountdownBanner :active="countdown" @go="emit('go')" />
    </div>
    <footer class="foot"><slot name="footer" /></footer>
  </div>
</template>

<style scoped>
.match { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 12px; }
.top { display: flex; align-items: center; gap: 18px; }
.heading { display: flex; flex-direction: column; flex: 1; }
.title { font-family: var(--font-display); font-size: 20px; letter-spacing: 0.14em; color: var(--neon-cyan); text-shadow: var(--glow-cyan); }
.subtitle { font-size: 11px; color: var(--text-dim); margin-top: 2px; }
.pips { display: flex; align-items: center; gap: 6px; }
.pips i { width: 12px; height: 12px; transform: rotate(45deg); border: 1px solid var(--text-dim); }
.pips i.won { background: var(--neon-green); border-color: var(--neon-green); box-shadow: var(--glow-green); }
.pips i.lost { background: var(--neon-red); border-color: var(--neon-red); }
.round-label { margin-left: 8px; font-size: 10px; letter-spacing: 0.2em; color: var(--text-dim); }
.clock { font-family: var(--font-display); font-size: 30px; font-weight: 800; color: var(--neon-green); text-shadow: var(--glow-green); min-width: 130px; text-align: right; }
.arena { position: relative; flex: 1; min-height: 0; overflow: auto; border: 1px solid var(--glass-edge); background: rgb(var(--editor-bg-rgb) / 0.9); padding: 18px 22px; }
.foot { display: flex; justify-content: flex-end; gap: 12px; min-height: 36px; }
</style>
