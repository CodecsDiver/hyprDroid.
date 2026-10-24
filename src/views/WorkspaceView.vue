<script setup lang="ts">
import GhostRaceOverlay from '../components/ghost/GhostRaceOverlay.vue'
import TypscryptionView from '../components/typscryption/TypscryptionView.vue'
import ThemeEditor from '../components/theme/ThemeEditor.vue'
import { usePracticeStore } from '../stores/practiceStore'
import { useThemeStore } from '../stores/themeStore'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { isNativeRuntime, openLabWindow } from '../backend/backend'
import { buildAppCommands } from '../commands/appCommands'
import { matchesShortcut } from '../commands/commandRegistry'
import { APP_COMMANDS_KEY } from '../commands/injection'
import BannerLayer from '../components/juice/BannerLayer.vue'
import JuiceLayer from '../components/juice/JuiceLayer.vue'
import LevelUpOverlay from '../components/juice/LevelUpOverlay.vue'
import CodeEditor from '../components/editor/CodeEditor.vue'
import EditorHeader from '../components/editor/EditorHeader.vue'
import PlayerHud from '../components/hud/PlayerHud.vue'
import MissionPanel from '../components/missions/MissionPanel.vue'
import OutputPanel from '../components/output/OutputPanel.vue'
import DebriefPanel from '../components/profile/DebriefPanel.vue'
import CommandPalette from '../components/shell/CommandPalette.vue'
import ConsentModal from '../components/shell/ConsentModal.vue'
import DialogHost from '../components/shell/DialogHost.vue'
import MenuBar from '../components/shell/MenuBar.vue'
import ResizeHandle from '../components/shell/ResizeHandle.vue'
import SettingsMenu from '../components/shell/SettingsMenu.vue'
import TitleBar from '../components/shell/TitleBar.vue'
import { PANEL_LIMITS } from '../layout/resize'
import { startSoundEngine } from '../juice/sound'
import { bootWebPython, onWebPythonStatus, type WebPythonStatus } from '../runtime/webPython'
import { useProgressionStore } from '../stores/progressionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useUiStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'

const settings = useSettingsStore()
const theme = useThemeStore()
const practice = usePracticeStore()
const progression = useProgressionStore()
const workspace = useWorkspaceStore()
const ui = useUiStore()

const editorRef = ref<InstanceType<typeof CodeEditor>>()
const webPythonStatus = ref<WebPythonStatus>('idle')
const webPythonFailure = ref('')
let stopWebPythonStatus: (() => void) | undefined
let stopSound: (() => void) | undefined

const commands = buildAppCommands({
  editorAction: (actionId) => editorRef.value?.runAction(actionId),
  focusEditor: () => editorRef.value?.focus(),
  openLab: openLabWindow,
  closeWindow: () => void (isNativeRuntime() && getCurrentWindow().close()),
})
provide(APP_COMMANDS_KEY, commands)

// --- panel sizing -------------------------------------------------------------------------------
const windowWidth = ref(window.innerWidth)
const windowHeight = ref(window.innerHeight)
const onResize = () => {
  windowWidth.value = window.innerWidth
  windowHeight.value = window.innerHeight
}
const HANDLE_WIDTH = 12
const LAYOUT_PADDING = 24

const leftMax = computed(() => {
  const rightUsed = settings.panels.quests ? settings.layout.rightWidth + HANDLE_WIDTH : 0
  const room = windowWidth.value - LAYOUT_PADDING - rightUsed - HANDLE_WIDTH - PANEL_LIMITS.centerMinWidth
  return Math.min(PANEL_LIMITS.sideMax, room)
})
const rightMax = computed(() => {
  const leftUsed = settings.panels.missions ? settings.layout.leftWidth + HANDLE_WIDTH : 0
  const room = windowWidth.value - LAYOUT_PADDING - leftUsed - HANDLE_WIDTH - PANEL_LIMITS.centerMinWidth
  return Math.min(PANEL_LIMITS.sideMax, room)
})
const outputMax = computed(() => Math.max(PANEL_LIMITS.outputMin, windowHeight.value - 420))

const gridColumns = computed(() =>
  [
    settings.panels.missions ? `${settings.layout.leftWidth}px ${HANDLE_WIDTH}px` : '',
    'minmax(0, 1fr)',
    settings.panels.quests ? `${HANDLE_WIDTH}px ${settings.layout.rightWidth}px` : '',
  ]
    .filter(Boolean)
    .join(' '),
)

// --- keyboard -----------------------------------------------------------------------------------
function handleKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || ui.isPaletteOpen || ui.dialog) return
  for (const command of commands) {
    if (command.handledByEditor || !command.shortcuts) continue
    if (!command.shortcuts.some((shortcut) => matchesShortcut(event, shortcut))) continue
    event.preventDefault()
    if (!command.isEnabled || command.isEnabled()) void command.run()
    return
  }
}

function saveWhenLeaving(): void {
  if (workspace.isDirty) void workspace.save({ manual: false })
}

onMounted(async () => {
  await settings.load()
  await theme.load()
  await progression.load()
  await practice.load()
  stopSound = startSoundEngine(() => settings.soundEnabled)
  if (!isNativeRuntime()) {
    stopWebPythonStatus = onWebPythonStatus((status, failure) => {
      webPythonStatus.value = status
      webPythonFailure.value = failure
    })
    // Pre-warm so the first Run does not wait for the WebAssembly download.
    bootWebPython().catch(() => undefined)
    void navigator.storage?.persist?.()
  }
  await workspace.initialize()
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('blur', saveWhenLeaving)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  stopSound?.()
  stopWebPythonStatus?.()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('blur', saveWhenLeaving)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="workspace" :class="{ focus: settings.focusMode }">
    <div class="realm-backdrop" />
    <TitleBar data-theme-part="titlebar" title="Python Discovery" subtitle="// no autocomplete. you write every line.">
      <button
        v-if="!isNativeRuntime()"
        class="chip chip-button"
        :class="webPythonStatus === 'ready' ? 'ok' : webPythonStatus === 'failed' ? 'bad' : 'warn'"
        :title="webPythonStatus === 'failed' ? `${webPythonFailure} (click to retry)` : 'Python runs in WebAssembly inside this page. Files are kept in this browser\'s storage.'"
        @click="webPythonStatus === 'failed' && bootWebPython().catch(() => undefined)"
      >
        {{ webPythonStatus === 'ready' ? 'WEB PYTHON READY' : webPythonStatus === 'booting' ? 'BOOTING PYTHON...' : webPythonStatus === 'failed' ? 'PYTHON FAILED - RETRY' : 'WEB PYTHON (loads on first run)' }}
      </button>
      <span v-else-if="workspace.sandbox && !workspace.sandbox.bubblewrapUsable" class="chip warn" title="sudo apt install bubblewrap">NO SANDBOX</span>
      <span v-else-if="workspace.sandbox" class="chip ok">SANDBOX ARMED</span>
      <span v-if="workspace.sandbox && !workspace.sandbox.pythonPath" class="chip bad">PYTHON 3 NOT FOUND</span>
      <button class="btn is-amber" @click="ui.openTypscryption()">&#9876; Typscryption</button>
      <button class="btn is-ghost" @click="ui.openThemeEditor()">&#9673; Theme</button>
      <button class="btn is-violet" @click="openLabWindow()">&#10022; Visualizer Lab</button>
      <SettingsMenu />
    </TitleBar>
    <MenuBar data-theme-part="menubar" />

    <PlayerHud data-theme-part="hud" />

    <main class="layout" :style="{ gridTemplateColumns: gridColumns }">
      <template v-if="settings.panels.missions">
        <MissionPanel class="side left" data-theme-part="missions" />
        <ResizeHandle
          orientation="vertical"
          label="missions panel"
          :size="settings.layout.leftWidth"
          :min="PANEL_LIMITS.sideMin"
          :max="leftMax"
          :default-size="300"
          @update:size="settings.layout.leftWidth = $event"
        />
      </template>

      <section class="center panel">
        <EditorHeader data-theme-part="tabs" />
        <div class="editor-slot" data-theme-part="editor">
          <CodeEditor
            v-if="workspace.isProjectLoaded"
            ref="editorRef"
            :key="`${workspace.selectedProjectId}:${workspace.activeFileName}`"
            :model-value="workspace.code"
            :font-size="settings.editorFontSize"
            @update:model-value="workspace.updateCode"
            @save="workspace.save({ manual: true })"
            @run="workspace.run()"
            @check="workspace.checkWork()"
            @palette="ui.openPalette()"
          />
          <div v-else class="loading">LOADING PROJECT...</div>
        </div>
        <div v-if="workspace.saveError" class="save-error">
          Save failed: [{{ workspace.saveError.code }}] {{ workspace.saveError.message }}
        </div>
        <template v-if="settings.panels.output">
          <ResizeHandle
            orientation="horizontal"
            label="output panel"
            invert
            :size="settings.layout.outputHeight"
            :min="PANEL_LIMITS.outputMin"
            :max="outputMax"
            :default-size="220"
            @update:size="settings.layout.outputHeight = $event"
          />
          <div class="output-slot" data-theme-part="output" :style="{ height: `${settings.layout.outputHeight}px` }"><OutputPanel /></div>
        </template>
      </section>

      <template v-if="settings.panels.quests">
        <ResizeHandle
          orientation="vertical"
          label="quests panel"
          invert
          :size="settings.layout.rightWidth"
          :min="PANEL_LIMITS.sideMin"
          :max="rightMax"
          :default-size="290"
          @update:size="settings.layout.rightWidth = $event"
        />
        <DebriefPanel class="side right" data-theme-part="quests" />
      </template>
    </main>

    <JuiceLayer />
    <BannerLayer />
    <LevelUpOverlay />
    <ConsentModal />
    <CommandPalette />
    <DialogHost />
    <ThemeEditor />
    <GhostRaceOverlay />
    <TypscryptionView />
  </div>
</template>

<style scoped>
.workspace { position: relative; display: flex; flex-direction: column; height: 100%; }
.layout { position: relative; z-index: 1; flex: 1; min-height: 0; display: grid; padding: 12px; }
.center { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: rgb(var(--editor-bg-rgb) / 0.88); }
.editor-slot { flex: 1; min-height: 0; position: relative; }
.output-slot { flex: none; border-top: 1px solid rgb(var(--neon-cyan-rgb) / 0.28); background: rgb(var(--void-rgb) / 0.7); }
.loading { display: grid; place-items: center; height: 100%; letter-spacing: 0.3em; color: var(--neon-cyan); }
.save-error { padding: 6px 14px; color: var(--neon-red); background: rgb(var(--neon-red-rgb) / 0.1); border-top: 1px solid var(--neon-red); font-size: 12px; }
.side { transition: opacity 0.35s, filter 0.35s; min-width: 0; }
.focus .side { opacity: 0.12; filter: blur(1px); }
.focus .side:hover { opacity: 1; filter: none; }
.chip { font-size: 10px; letter-spacing: 0.14em; padding: 3px 8px; border: 1px solid; }
.chip.ok { color: var(--neon-green); border-color: var(--neon-green); }
.chip.warn { color: var(--neon-amber); border-color: var(--neon-amber); }
.chip.bad { color: var(--neon-red); border-color: var(--neon-red); }
.chip-button { background: transparent; font-family: inherit; cursor: default; }
.chip-button.bad { cursor: pointer; }
</style>
