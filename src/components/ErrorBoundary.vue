<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'

const props = withDefaults(defineProps<{ label?: string; compact?: boolean }>(), { label: 'This part of Signal Home', compact: false })
const failure = ref<Error | null>(null)
const attempt = ref(0)

onErrorCaptured((error, _instance, info) => {
  console.error(`[error-boundary] ${props.label}:`, info, error)
  failure.value = error instanceof Error ? error : new Error(String(error))
  return false // contained: do not take down the rest of the app
})

function retry(): void {
  failure.value = null
  attempt.value++
}
</script>

<template>
  <div v-if="failure" class="boundary" :class="{ 'boundary--compact': compact }" role="alert">
    <p class="boundary__title">{{ label }} ran into a problem.</p>
    <p class="hint">Nothing you sent was lost. You can try again.</p>
    <button type="button" class="btn btn--small" @click="retry">Try again</button>
  </div>
  <slot v-else :key="attempt" />
</template>

<style scoped>
.boundary {
  display: grid;
  gap: var(--space-2);
  justify-items: center;
  text-align: center;
  padding: var(--space-5) var(--space-4);
}
.boundary--compact {
  padding: var(--space-3);
}
.boundary__title {
  margin: 0;
  font-weight: 700;
}
</style>
