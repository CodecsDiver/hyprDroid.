<script setup lang="ts">
import { requestDelete, requestNewFile, requestRename } from '../../commands/fileActions'
import { MAIN_FILE_NAME } from '../../curriculum/projects'
import { useWorkspaceStore } from '../../stores/workspaceStore'

const workspace = useWorkspaceStore()
</script>

<template>
  <div class="tabs" role="tablist" aria-label="Files in this mission">
    <div
      v-for="name in workspace.fileNames"
      :key="name"
      class="tab"
      :class="{ active: name === workspace.activeFileName }"
      role="tab"
      :aria-selected="name === workspace.activeFileName"
      :title="name"
      @click="workspace.openFile(name)"
    >
      <span class="tab-icon">PY</span>
      <span class="tab-name">{{ name }}</span>
      <span v-if="name === workspace.activeFileName && workspace.isDirty" class="dirty-dot" title="Unsaved changes" />
      <span v-if="name !== MAIN_FILE_NAME" class="tab-actions">
        <button class="tab-action" title="Rename" @click.stop="requestRename(name)">&#9998;</button>
        <button class="tab-action danger" title="Delete" @click.stop="requestDelete(name)">&#10005;</button>
      </span>
    </div>
    <button class="new-file" title="New file (Ctrl+Alt+N)" @click="requestNewFile()">+ New file</button>
  </div>
</template>

<style scoped>
.tabs { display: flex; align-items: flex-end; gap: 4px; min-width: 0; overflow-x: auto; }
.tab {
  display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer; white-space: nowrap;
  color: var(--text-dim); background: rgba(255, 255, 255, 0.03); border-top: 2px solid transparent;
}
.tab:hover { color: var(--text); background: rgba(25, 230, 255, 0.08); }
.tab.active {
  color: var(--text); font-weight: 700; border-top-color: var(--neon-cyan);
  background: linear-gradient(180deg, rgba(25, 230, 255, 0.16), rgba(25, 230, 255, 0.02));
}
.tab-icon { font-size: 9px; padding: 1px 4px; color: var(--void); background: var(--neon-amber); border-radius: 2px; }
.dirty-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--neon-amber); box-shadow: 0 0 8px var(--neon-amber); }
.tab-actions { display: none; gap: 2px; margin-left: 2px; }
.tab:hover .tab-actions, .tab.active .tab-actions { display: inline-flex; }
.tab-action { width: 20px; height: 20px; padding: 0; border: 0; background: transparent; color: var(--text-dim); cursor: pointer; font-size: 12px; }
.tab-action:hover { color: var(--neon-cyan); background: rgba(25, 230, 255, 0.15); }
.tab-action.danger:hover { color: #fff; background: var(--neon-red); }
.new-file {
  padding: 6px 12px; cursor: pointer; white-space: nowrap; font-size: 12px; color: var(--neon-green);
  background: transparent; border: 1px dashed rgba(57, 255, 136, 0.5);
}
.new-file:hover { background: rgba(57, 255, 136, 0.12); box-shadow: var(--glow-green); }
</style>
