<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import FileTabs from './FileTabs.vue'

const workspace = useWorkspaceStore()

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
    <button class="btn is-ghost" :disabled="!workspace.isDirty || workspace.isSaving" @click="workspace.save({ manual: true })">
      Save <span class="kbd">Ctrl+S</span>
    </button>
    <button class="btn is-green" :disabled="workspace.isBusy" @click="workspace.run()">
      <span class="glyph">&#9654;</span> Run <span class="kbd on-color">Ctrl+Enter</span>
    </button>
    <button class="btn is-violet is-hero" :disabled="workspace.isBusy" @click="workspace.checkWork()">
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
</style>
