<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isNativeRuntime } from './backend/backend'
import VisualizerLabView from './views/VisualizerLabView.vue'
import WorkspaceView from './views/WorkspaceView.vue'

const LAB_WINDOW_LABEL = 'lab'

const isVisualizerLab = isNativeRuntime()
  ? getCurrentWindow().label === LAB_WINDOW_LABEL
  : new URLSearchParams(location.search).get('view') === 'lab'
</script>

<template>
  <VisualizerLabView v-if="isVisualizerLab" />
  <WorkspaceView v-else />
</template>
