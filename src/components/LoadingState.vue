<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'Loading…' })
</script>

<template>
  <div class="loading" role="status">
    <span class="loading__dot" aria-hidden="true" />
    <span>{{ label }}</span>
  </div>
</template>

<style scoped>
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-5);
  color: var(--color-ink-muted);
}
.loading__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-rose);
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(0.7); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .loading__dot { animation: none; }
}
:root[data-motion='reduced'] .loading__dot { animation: none; }
</style>
