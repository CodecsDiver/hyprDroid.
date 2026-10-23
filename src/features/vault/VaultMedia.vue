<script setup lang="ts">
import { computed, ref } from 'vue'
import { fileUrl } from '@/data/files'
import type { Memory } from '@/data/repos/vault'

const props = defineProps<{ memory: Memory }>()
const url = computed(() => (props.memory.fileId ? fileUrl(props.memory.fileId) : null))
const failed = ref(false)
</script>

<template>
  <p v-if="failed" class="error-text" role="alert">This file could not be loaded.</p>
  <img v-else-if="memory.kind === 'photo' && url" class="photo" :src="url" :alt="memory.title" loading="lazy" decoding="async" @error="failed = true" />
  <audio v-else-if="memory.kind === 'voice' && url" class="audio" :src="url" controls preload="none" :aria-label="`Voice message: ${memory.title}`" @error="failed = true" />
  <div v-else-if="memory.fileId" class="placeholder" aria-hidden="true" />
</template>

<style scoped>
.photo { width: 100%; max-height: 360px; object-fit: contain; border-radius: var(--radius-sm); background: rgba(0, 0, 0, 0.35); }
.audio { width: 100%; }
.placeholder { height: 120px; border-radius: var(--radius-sm); background: var(--surface-glass); }
</style>
