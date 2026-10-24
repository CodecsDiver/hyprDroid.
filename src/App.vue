<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isNativeRuntime } from './backend/backend'
import SolutionView from './views/SolutionView.vue'
import VisualizerLabView from './views/VisualizerLabView.vue'
import WorkspaceView from './views/WorkspaceView.vue'

const windowKind = isNativeRuntime() ? getCurrentWindow().label : (new URLSearchParams(location.search).get('view') ?? 'main')
</script>

<template>
  <VisualizerLabView v-if="windowKind === 'lab'" />
  <SolutionView v-else-if="windowKind === 'solution'" />
  <WorkspaceView v-else />
</template>
