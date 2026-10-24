<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useComboStore } from '../../stores/comboStore'
import { useProgressionStore } from '../../stores/progressionStore'
import LevelBar from './LevelBar.vue'

const progression = useProgressionStore()
const combo = useComboStore()

const displayedLevel = ref(progression.levelProgress.level)
const isLevelBadgePopping = ref(false)
const isXpPopping = ref(false)

// The badge number changes only after the bar has finished its fill-and-reset sequence.
watch(
  () => progression.levelProgress.level,
  async (level, previous) => {
    if (level <= previous) {
      displayedLevel.value = level
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 760))
    displayedLevel.value = level
    isLevelBadgePopping.value = false
    await nextTick()
    isLevelBadgePopping.value = true
    setTimeout(() => (isLevelBadgePopping.value = false), 900)
  },
)

watch(
  () => progression.state.totalXp,
  async () => {
    isXpPopping.value = false
    await nextTick()
    isXpPopping.value = true
    setTimeout(() => (isXpPopping.value = false), 400)
  },
)
</script>

<template>
  <section class="hud panel">
    <div class="badge" :class="{ popping: isLevelBadgePopping }">
      <span class="badge-label">LVL</span>
      <span class="badge-level">{{ displayedLevel }}</span>
    </div>

    <div class="identity">
      <div class="rank">{{ progression.rankTitle }}</div>
      <div class="xp-total" :class="{ popping: isXpPopping }">
        {{ progression.state.totalXp.toLocaleString() }} <span class="mono-dim">XP TOTAL</span>
      </div>
    </div>

    <div class="bar-slot">
      <LevelBar :total-xp="progression.state.totalXp" />
    </div>

    <div class="combo" :class="[`tier-${combo.multiplier}`, { active: combo.combo > 0 }]">
      <div class="combo-count">{{ combo.combo }}</div>
      <div class="combo-meta">
        <div class="combo-label">COMBO</div>
        <div class="combo-multiplier">x{{ combo.multiplier }}</div>
      </div>
      <div class="combo-decay"><div class="combo-decay-fill" :style="{ transform: `scaleX(${combo.decayProgress})` }" /></div>
    </div>
  </section>
</template>

<style scoped>
.hud {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: auto 190px 1fr 190px;
  align-items: center;
  gap: 20px;
  margin: 10px 12px 0;
  padding: 10px 22px;
}
.badge {
  position: relative;
  display: grid;
  place-items: center;
  width: 62px;
  height: 62px;
  background: linear-gradient(145deg, rgb(var(--neon-green-rgb) / 0.28), rgb(var(--neon-violet-rgb) / 0.3));
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  box-shadow: inset 0 0 0 2px var(--neon-green);
}
.badge-label { position: absolute; top: 8px; font-size: 8px; letter-spacing: 0.25em; color: var(--neon-green); }
.badge-level {
  margin-top: 8px;
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 900;
  color: var(--flash);
  text-shadow: var(--glow-green);
}
.badge.popping { animation: badge-pop 0.9s cubic-bezier(0.2, 1.6, 0.3, 1); }
@keyframes badge-pop {
  0% { transform: scale(1); filter: brightness(1); }
  25% { transform: scale(calc(1 + 0.6 * var(--fx-scale))) rotate(8deg); filter: brightness(2.5); }
  100% { transform: scale(1); filter: brightness(1); }
}
.rank {
  font-family: var(--font-display);
  font-size: 14px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--neon-cyan);
  text-shadow: var(--glow-cyan);
}
.xp-total { margin-top: 4px; font-size: 16px; font-weight: 700; color: var(--neon-green); }
.xp-total .mono-dim { font-size: 9px; letter-spacing: 0.2em; font-weight: 400; }
.xp-total.popping { animation: xp-pop 0.4s ease-out; }
@keyframes xp-pop { 0% { transform: scale(calc(1 + 0.25 * var(--fx-scale))); color: var(--flash); } 100% { transform: scale(1); } }

.combo {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 6px 10px 12px;
  color: var(--text-dim);
  border: 1px solid rgb(var(--text-dim-rgb) / 0.25);
  transition: color 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.combo-count { font-family: var(--font-display); font-size: 30px; font-weight: 900; min-width: 50px; text-align: right; }
.combo-label { font-size: 9px; letter-spacing: 0.3em; }
.combo-multiplier { font-family: var(--font-display); font-size: 18px; font-weight: 800; }
.combo-decay { position: absolute; left: 6px; right: 6px; bottom: 4px; height: 3px; background: rgba(255, 255, 255, 0.08); }
.combo-decay-fill { height: 100%; transform-origin: left; background: currentColor; }
.combo.active { color: var(--combo-t1); border-color: var(--combo-t1); box-shadow: 0 0 calc(var(--glow-size) * var(--fx-scale)) var(--combo-t1); }
.combo.tier-2 { color: var(--combo-t2); border-color: var(--combo-t2); box-shadow: 0 0 calc(var(--glow-size) * var(--fx-scale)) var(--combo-t2); }
.combo.tier-3 { color: var(--combo-t3); border-color: var(--combo-t3); box-shadow: 0 0 calc(var(--glow-size) * var(--fx-scale)) var(--combo-t3); }
.combo.tier-4 { color: var(--combo-t4); border-color: var(--combo-t4); }
.combo.tier-5 { color: var(--combo-t5); border-color: var(--combo-t5); box-shadow: 0 0 calc(var(--glow-size) * var(--fx-scale)) var(--combo-t5); animation: combo-shiver 0.12s linear infinite; }
:root[data-fx='off'] .combo.tier-5 { animation: none; }
@keyframes combo-shiver {
  0% { transform: translate(calc(1px * var(--fx-scale)), 0); }
  50% { transform: translate(calc(-1px * var(--fx-scale)), calc(1px * var(--fx-scale))); }
  100% { transform: translate(0, calc(-1px * var(--fx-scale))); }
}
</style>
