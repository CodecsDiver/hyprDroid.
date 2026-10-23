<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isNativeRuntime } from './backend/backend'
import LessonLabView from './views/LessonLabView.vue'
import WorkspaceView from './views/WorkspaceView.vue'

const LESSONS_WINDOW_LABEL = 'lessons'

const isLessonLab = isNativeRuntime()
  ? getCurrentWindow().label === LESSONS_WINDOW_LABEL
  : new URLSearchParams(location.search).get('view') === 'lessons'
</script>

<template>
  <LessonLabView v-if="isLessonLab" />
  <WorkspaceView v-else />
</template>
