<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceStore } from '../../stores/workspaceStore'

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
    <div class="tab" :class="{ dirty: workspace.isDirty }">
      <span class="tab-icon">PY</span>
      main.py
      <span v-if="workspace.isDirty" class="dirty-dot" title="Unsaved changes" />
    </div>
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
.editor-header { display: flex; align-items: center; gap: 12px; padding: 8px 14px; border-bottom: 1px solid rgba(25, 230, 255, 0.16); }
.tab {
  display: flex; align-items: center; gap: 8px; padding: 6px 14px;
  font-weight: 700; color: var(--text);
  background: linear-gradient(180deg, rgba(25, 230, 255, 0.16), rgba(25, 230, 255, 0.02));
  border-top: 2px solid var(--neon-cyan);
}
.tab-icon { font-size: 9px; padding: 1px 4px; color: var(--void); background: var(--neon-amber); border-radius: 2px; }
.dirty-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--neon-amber); box-shadow: 0 0 8px var(--neon-amber); }
.save-state { font-size: 10px; letter-spacing: 0.2em; }
.save-state.clean { color: var(--neon-green); }
.save-state.dirty { color: var(--neon-amber); }
.save-state.error { color: var(--neon-red); text-shadow: var(--glow-red); animation: blink 0.9s step-end infinite; }
@keyframes blink { 50% { opacity: 0.35; } }
.spacer { flex: 1; }
.glyph { font-size: 12px; }
.kbd { color: rgba(4, 5, 10, 0.65); border-color: rgba(4, 5, 10, 0.35); letter-spacing: 0; }
.btn.is-ghost .kbd { color: var(--text-dim); border-color: rgba(113, 134, 160, 0.4); }
</style>
