<script setup lang="ts">
defineProps<{
  youLabel?: string
  botLabel: string
  /** 0..1 */
  you: number
  bot: number
  /** The clocks shown at the end of each lane. */
  youTime?: string
  botTime?: string
}>()
</script>

<template>
  <div class="lanes">
    <div class="lane you">
      <span class="who">{{ youLabel ?? 'YOU' }}</span>
      <div class="track"><i class="runner" :style="{ left: `${Math.min(1, Math.max(0, you)) * 100}%` }">&#9679;</i><b class="fill" :style="{ width: `${Math.min(1, Math.max(0, you)) * 100}%` }" /></div>
      <span class="time">{{ youTime ?? '' }}</span>
    </div>
    <div class="lane bot">
      <span class="who">{{ botLabel }}</span>
      <div class="track"><i class="runner" :style="{ left: `${Math.min(1, Math.max(0, bot)) * 100}%` }">&#9670;</i><b class="fill" :style="{ width: `${Math.min(1, Math.max(0, bot)) * 100}%` }" /></div>
      <span class="time">{{ botTime ?? '' }}</span>
    </div>
  </div>
</template>

<style scoped>
.lanes { display: flex; flex-direction: column; gap: 8px; }
.lane { display: grid; grid-template-columns: 120px 1fr 70px; align-items: center; gap: 12px; }
.who { font-size: 10px; letter-spacing: 0.26em; }
.time { font-family: var(--font-display); font-size: 13px; text-align: right; }
.track { position: relative; height: 12px; background: rgb(var(--void-rgb) / 0.8); border: 1px solid rgb(var(--text-dim-rgb) / 0.4); }
.fill { position: absolute; inset: 0 auto 0 0; transition: width 0.12s linear; }
.runner { position: absolute; top: -5px; transform: translateX(-50%); font-style: normal; font-size: 14px; transition: left 0.12s linear; }
.you .who, .you .time, .you .runner { color: var(--neon-green); }
.you .fill { background: linear-gradient(90deg, rgb(var(--neon-green-rgb) / 0.15), rgb(var(--neon-green-rgb) / 0.7)); }
.you .runner { text-shadow: var(--glow-green); }
.bot .who, .bot .time, .bot .runner { color: var(--neon-violet); }
.bot .fill { background: linear-gradient(90deg, rgb(var(--neon-violet-rgb) / 0.15), rgb(var(--neon-violet-rgb) / 0.7)); }
.bot .runner { text-shadow: var(--glow-violet); }
</style>
