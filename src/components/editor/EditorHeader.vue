<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatMs } from '../../ghost/ghostRecord'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { MAX_STRIKES } from '../../practice/strikes'
import { usePracticeStore } from '../../stores/practiceStore'
import { visualizeActiveFile } from '../../commands/visualizeAction'
import FileTabs from './FileTabs.vue'

const workspace = useWorkspaceStore()
const visualizeNow = () => visualizeActiveFile()
const practice = usePracticeStore()
const clock = ref(0)
const bestMs = computed(() => practice.ghostFor(`mission:${workspace.selectedProjectId}`)?.ms ?? 0)
let clockTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => (clockTimer = setInterval(() => (clock.value = workspace.runElapsedMs()), 200)))
onBeforeUnmount(() => clearInterval(clockTimer))
const strikes = computed(() => practice.strikesFor(workspace.selectedProjectId))
const canViewSolution = computed(() => practice.canViewSolution(workspace.selectedProjectId))

const saveLabel = computed(() => {
  if (workspace.saveError) return 'SAVE FAILED'
  if (workspace.isSaving) return 'SAVING...'
  if (workspace.isDirty) return 'UNSAVED'
  return workspace.lastSavedAt ? 'SAVED' : 'READY'
})
const saveState = computed(() => {
  if (workspace.saveError) return 'error'
  if (workspace.isDirty || workspace.isSaving) return 'dirty'
  return 'clean'
})
</script>

<template>
  <div class="editor-header">
    <FileTabs />
    <div class="save-state" :class="saveState" :title="workspace.saveError?.message">{{ saveLabel }}</div>
    <div class="spacer" />
    <div v-if="workspace.isRecording" class="run-clock" title="Time on this mission since your first keystroke. Breaks over 15 s barely count. Your first all-green check becomes your ghost.">
      <span class="strikes-label">TIME</span><b>{{ formatMs(clock) }}</b>
      <span v-if="bestMs" class="best-chip">BEST {{ formatMs(bestMs) }}</span>
    </div>
    <div v-if="!workspace.isFreeCode" class="strikes" :title="`Failed Check my work runs on this mission: ${strikes} of ${MAX_STRIKES}. Running code never counts. At ${MAX_STRIKES} the full commented solution opens.`">
      <span class="strikes-label">STRIKES</span>
      <i v-for="slot in MAX_STRIKES" :key="slot" :class="{ used: slot <= strikes }" />
    </div>
    <button v-if="canViewSolution" class="btn is-ghost" @click="practice.openSolution(workspace.selectedProjectId)">Solution</button>
    <button class="btn is-ghost" :disabled="!workspace.isDirty || workspace.isSaving" @click="workspace.save({ manual: true })">
      Save <span class="kbd">Ctrl+S</span>
    </button>
    <button class="btn is-green" :disabled="workspace.isBusy" @click="workspace.run()">
      <span class="glyph">&#9654;</span> Run <span class="kbd on-color">Ctrl+Enter</span>
    </button>
    <button class="btn is-ghost" :disabled="workspace.isBusy" title="Run this file and animate the first list of numbers it changes (Run menu)" @click="visualizeNow()">
      &#9672; Visualize
    </button>
    <button class="btn is-violet is-hero" :disabled="workspace.isBusy || workspace.isFreeCode" :title="workspace.isFreeCode ? 'Free Code has nothing to check. Pick a mission to be checked.' : ''" @click="workspace.checkWork()">
      <span class="glyph">&#10022;</span> {{ workspace.isChecking ? 'Verifying...' : 'Check my work' }}
    </button>
  </div>
</template>

<style scoped>
.editor-header { display: flex; align-items: center; gap: 12px; padding: 8px 14px; flex-wrap: wrap; border-bottom: 1px solid rgb(var(--neon-cyan-rgb) / 0.16); }
.save-state { font-size: 10px; letter-spacing: 0.2em; }
.save-state.clean { color: var(--neon-green); }
.save-state.dirty { color: var(--neon-amber); }
.save-state.error { color: var(--neon-red); text-shadow: var(--glow-red); animation: blink 0.9s step-end infinite; }
@keyframes blink { 50% { opacity: 0.35; } }
.spacer { flex: 1; }
.glyph { font-size: 12px; }
.kbd { color: rgb(var(--void-rgb) / 0.65); border-color: rgb(var(--void-rgb) / 0.35); letter-spacing: 0; }
.btn.is-ghost .kbd { color: var(--text-dim); border-color: rgb(var(--text-dim-rgb) / 0.4); }
.strikes { display: flex; align-items: center; gap: 5px; }
.strikes-label { font-size: 9px; letter-spacing: 0.22em; color: var(--text-dim); margin-right: 2px; }
.strikes i { width: 10px; height: 10px; transform: rotate(45deg); border: 1px solid var(--neon-red); transition: background 0.2s, box-shadow 0.2s; }
.strikes i.used { background: var(--neon-red); box-shadow: var(--glow-red); }
.run-clock { display: flex; align-items: center; gap: 6px; }
.run-clock b { font-family: var(--font-display); color: var(--neon-green); font-size: 13px; }
.best-chip { font-size: 9px; letter-spacing: 0.14em; color: var(--neon-violet); }
</style>
