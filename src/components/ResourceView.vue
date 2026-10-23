<script setup lang="ts">
import LoadingState from './LoadingState.vue'

defineProps<{ loading: boolean; error: string | null }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <LoadingState v-if="loading" />
  <div v-else-if="error" class="stack" role="alert">
    <p class="error-text">{{ error }}</p>
    <button type="button" class="btn btn--small" @click="$emit('retry')">Try again</button>
  </div>
  <slot v-else />
</template>
