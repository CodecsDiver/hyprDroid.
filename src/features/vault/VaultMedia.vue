<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { signedUrl } from '@/data/storage'
import type { Memory } from '@/data/repos/vault'

const props = defineProps<{ memory: Memory }>()
const url = ref<string | null>(null)
const failed = ref(false)

onMounted(async () => {
  if (!props.memory.storagePath) return
  try {
    url.value = await signedUrl('vault', props.memory.storagePath)
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <p v-if="failed" class="error-text" role="alert">This file could not be loaded.</p>
  <img v-else-if="memory.kind === 'photo' && url" class="photo" :src="url" :alt="memory.title" loading="lazy" decoding="async" />
  <audio v-else-if="memory.kind === 'voice' && url" class="audio" :src="url" controls preload="none" :aria-label="`Voice message: ${memory.title}`" />
  <div v-else-if="memory.storagePath" class="placeholder" aria-hidden="true" />
</template>

<style scoped>
.photo { width: 100%; max-height: 360px; object-fit: contain; border-radius: var(--radius-sm); background: rgba(0, 0, 0, 0.35); }
.audio { width: 100%; }
.placeholder { height: 120px; border-radius: var(--radius-sm); background: var(--surface-glass); }
</style>
