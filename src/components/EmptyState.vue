<script setup lang="ts">
defineProps<{ title: string; hint?: string; emoji?: string }>()
</script>

<template>
  <div class="empty">
    <div v-if="emoji" class="empty__emoji" aria-hidden="true">{{ emoji }}</div>
    <p class="empty__title">{{ title }}</p>
    <p v-if="hint" class="hint">{{ hint }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty {
  display: grid;
  gap: var(--space-2);
  justify-items: center;
  text-align: center;
  padding: var(--space-5) var(--space-3);
  color: var(--color-ink-muted);
}
.empty__emoji {
  font-size: 2rem;
}
.empty__title {
  margin: 0;
  font-weight: 700;
  color: var(--color-ink);
}
</style>
