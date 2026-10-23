<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { isNativeRuntime, openLessonsWindow } from '../backend/backend'
import { subscribeLessonStudied } from '../backend/crossWindow'
import BannerLayer from '../components/juice/BannerLayer.vue'
import JuiceLayer from '../components/juice/JuiceLayer.vue'
import LevelUpOverlay from '../components/juice/LevelUpOverlay.vue'
import CodeEditor from '../components/editor/CodeEditor.vue'
import EditorHeader from '../components/editor/EditorHeader.vue'
import PlayerHud from '../components/hud/PlayerHud.vue'
import MissionPanel from '../components/missions/MissionPanel.vue'
import OutputPanel from '../components/output/OutputPanel.vue'
import DebriefPanel from '../components/profile/DebriefPanel.vue'
import ConsentModal from '../components/shell/ConsentModal.vue'
import SettingsMenu from '../components/shell/SettingsMenu.vue'
import TitleBar from '../components/shell/TitleBar.vue'
import { onWebPythonStatus, bootWebPython, type WebPythonStatus } from '../runtime/webPython'
import { startSoundEngine } from '../juice/sound'
import { useProgressionStore } from '../stores/progressionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useWorkspaceStore } from '../stores/workspaceStore'

const settings = useSettingsStore()
const progression = useProgressionStore()
const workspace = useWorkspaceStore()

const webPythonStatus = ref<WebPythonStatus>('idle')
let stopWebPythonStatus: (() => void) | undefined
let stopSound: (() => void) | undefined
let stopLessonSubscription: (() => void) | undefined

function handleKeydown(event: KeyboardEvent): void {
  const isCommand = event.ctrlKey || event.metaKey
  if (!isCommand) return
  if (event.key.toLowerCase() === 's') {
    event.preventDefault()
    void workspace.save({ manual: true })
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (event.shiftKey) void workspace.checkWork()
    else void workspace.run()
  }
}

function saveWhenLeaving(): void {
  if (workspace.isDirty) void workspace.save({ manual: false })
}

onMounted(async () => {
  await settings.load()
  await progression.load()
  stopSound = startSoundEngine(() => settings.soundEnabled)
  stopLessonSubscription = await subscribeLessonStudied((lessonId) => {
    progression.record({ type: 'lesson_studied', lessonId })
  })
  if (!isNativeRuntime()) {
    stopWebPythonStatus = onWebPythonStatus((status) => (webPythonStatus.value = status))
    // Pre-warm so the first Run does not wait for the WebAssembly download; failures surface on first Run.
    bootWebPython().catch(() => undefined)
    void navigator.storage?.persist?.()
  }
  await workspace.initialize()
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('blur', saveWhenLeaving)
})

onBeforeUnmount(() => {
  stopSound?.()
  stopWebPythonStatus?.()
  stopLessonSubscription?.()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('blur', saveWhenLeaving)
})
</script>

<template>
  <div class="workspace" :class="{ focus: settings.focusMode }">
    <div class="realm-backdrop" />
    <TitleBar title="Python Discovery" subtitle="// no autocomplete. you write every line.">
      <span v-if="!isNativeRuntime()" class="chip" :class="webPythonStatus === 'ready' ? 'ok' : 'warn'" title="Python runs in WebAssembly inside this page. Files are kept in this browser's storage.">
        {{ webPythonStatus === 'ready' ? 'WEB PYTHON READY' : webPythonStatus === 'booting' ? 'BOOTING PYTHON...' : 'WEB PYTHON (loads on first run)' }}
      </span>
      <span v-else-if="workspace.sandbox && !workspace.sandbox.bubblewrapUsable" class="chip warn" title="sudo apt install bubblewrap">NO SANDBOX</span>
      <span v-else-if="workspace.sandbox" class="chip ok">SANDBOX ARMED</span>
      <span v-if="workspace.sandbox && !workspace.sandbox.pythonPath" class="chip bad">PYTHON 3 NOT FOUND</span>
      <button class="btn is-violet" @click="openLessonsWindow()">&#10022; Lesson Lab</button>
      <SettingsMenu />
    </TitleBar>

    <PlayerHud />

    <main class="layout">
      <MissionPanel class="side left" />

      <section class="center panel">
        <EditorHeader />
        <div class="editor-slot">
          <CodeEditor
            v-if="workspace.isProjectLoaded"
            :key="workspace.selectedProjectId"
            :model-value="workspace.code"
            @update:model-value="workspace.updateCode"
            @save="workspace.save({ manual: true })"
            @run="workspace.run()"
            @check="workspace.checkWork()"
          />
          <div v-else class="loading">LOADING PROJECT...</div>
        </div>
        <div v-if="workspace.saveError" class="save-error">
          Save failed: [{{ workspace.saveError.code }}] {{ workspace.saveError.message }}
        </div>
        <div class="output-slot"><OutputPanel /></div>
      </section>

      <DebriefPanel class="side right" />
    </main>

    <JuiceLayer />
    <BannerLayer />
    <LevelUpOverlay />
    <ConsentModal />
  </div>
</template>

<style scoped>
.workspace { position: relative; display: flex; flex-direction: column; height: 100%; }
.layout {
  position: relative; z-index: 1; flex: 1; min-height: 0;
  display: grid; grid-template-columns: 300px minmax(0, 1fr) 290px; gap: 12px; padding: 12px;
}
.center { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: rgba(6, 9, 18, 0.88); }
.editor-slot { flex: 1; min-height: 0; position: relative; }
.output-slot { height: 220px; border-top: 1px solid rgba(25, 230, 255, 0.28); background: rgba(4, 5, 10, 0.7); }
.loading { display: grid; place-items: center; height: 100%; letter-spacing: 0.3em; color: var(--neon-cyan); }
.save-error { padding: 6px 14px; color: var(--neon-red); background: rgba(255, 61, 110, 0.1); border-top: 1px solid var(--neon-red); font-size: 12px; }
.side { transition: opacity 0.35s, filter 0.35s; }
.focus .side { opacity: 0.12; filter: blur(1px); }
.focus .side:hover { opacity: 1; filter: none; }
.chip { font-size: 10px; letter-spacing: 0.14em; padding: 3px 8px; border: 1px solid; }
.chip.ok { color: var(--neon-green); border-color: var(--neon-green); }
.chip.warn { color: var(--neon-amber); border-color: var(--neon-amber); }
.chip.bad { color: var(--neon-red); border-color: var(--neon-red); }
</style>
