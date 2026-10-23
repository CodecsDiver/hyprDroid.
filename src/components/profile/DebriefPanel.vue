<script setup lang="ts">
import { ACHIEVEMENTS, QUESTS } from '../../gamification/progressionEngine'
import { useProgressionStore } from '../../stores/progressionStore'

const progression = useProgressionStore()

const questProgress = (measure: (state: typeof progression.state) => number, target: number) =>
  Math.min(measure(progression.state), target)
</script>

<template>
  <aside class="debrief panel">
    <div class="panel-title">Quests</div>
    <ul class="quests">
      <li v-for="quest in QUESTS" :key="quest.id" class="quest" :class="{ done: progression.state.completedQuestIds.includes(quest.id) }">
        <div class="quest-head">
          <span class="quest-title">{{ quest.title }}</span>
          <span class="quest-reward">+{{ quest.rewardXp }} XP</span>
        </div>
        <div class="quest-desc">{{ quest.description }}</div>
        <div class="quest-bar">
          <div class="quest-fill" :style="{ transform: `scaleX(${questProgress(quest.measureProgress, quest.targetCount) / quest.targetCount})` }" />
        </div>
        <div class="quest-count">{{ questProgress(quest.measureProgress, quest.targetCount) }} / {{ quest.targetCount }}</div>
      </li>
    </ul>

    <div class="panel-title">Trophies</div>
    <ul class="trophies">
      <li
        v-for="achievement in ACHIEVEMENTS"
        :key="achievement.id"
        class="trophy"
        :class="{ unlocked: progression.state.unlockedAchievementIds.includes(achievement.id) }"
        :title="achievement.description"
      >
        <span class="trophy-icon">&#9670;</span>
        <span class="trophy-title">{{ achievement.title }}</span>
        <span class="trophy-desc">{{ achievement.description }}</span>
      </li>
    </ul>

    <div class="stats">
      <div><b>{{ progression.state.fileSaveCount }}</b> saves</div>
      <div><b>{{ progression.state.codeRunCount }}</b> runs</div>
      <div><b>{{ progression.state.bestCombo }}</b> best combo</div>
    </div>
    <div v-if="progression.saveError" class="warning">Progress could not be written: {{ progression.saveError }}</div>
  </aside>
</template>

<style scoped>
.debrief { display: flex; flex-direction: column; min-height: 0; overflow: auto; }
.quests, .trophies { list-style: none; margin: 0; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.quest { padding: 9px 10px; border: 1px solid rgba(113, 134, 160, 0.25); background: rgba(4, 5, 10, 0.5); }
.quest.done { border-color: var(--neon-violet); background: rgba(164, 92, 255, 0.1); }
.quest-head { display: flex; justify-content: space-between; }
.quest-title { font-weight: 700; }
.quest-reward { color: var(--neon-amber); font-size: 11px; }
.quest-desc { margin: 2px 0 6px; font-size: 11px; color: var(--text-dim); }
.quest-bar { height: 5px; background: rgba(255, 255, 255, 0.08); }
.quest-fill { height: 100%; transform-origin: left; background: linear-gradient(90deg, var(--neon-cyan), var(--neon-violet)); transition: transform 0.6s cubic-bezier(0.2, 0.9, 0.2, 1); }
.quest.done .quest-fill { background: var(--neon-violet); box-shadow: var(--glow-violet); }
.quest-count { margin-top: 3px; font-size: 10px; color: var(--text-dim); text-align: right; }
.trophy { display: grid; grid-template-columns: 20px 1fr; column-gap: 8px; padding: 6px 4px; opacity: 0.38; filter: grayscale(1); }
.trophy.unlocked { opacity: 1; filter: none; }
.trophy-icon { grid-row: span 2; color: var(--neon-amber); font-size: 16px; text-shadow: 0 0 10px var(--neon-amber); }
.trophy-title { font-weight: 700; }
.trophy-desc { font-size: 10px; color: var(--text-dim); }
.stats { display: flex; justify-content: space-around; margin-top: auto; padding: 10px; border-top: 1px solid rgba(25, 230, 255, 0.16); font-size: 11px; color: var(--text-dim); }
.stats b { color: var(--neon-cyan); font-size: 15px; }
.warning { margin: 0 12px 10px; padding: 6px 8px; font-size: 11px; color: var(--neon-red); border: 1px solid var(--neon-red); }
</style>
