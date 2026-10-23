<script setup lang="ts">
import { dismissToast, toasts } from '@/state/toasts'
</script>

<template>
  <div class="toasts" role="status" aria-live="polite" aria-atomic="false">
    <div v-for="toast in toasts" :key="toast.id" class="toast" :class="`toast--${toast.tone}`">
      <span class="toast__text">{{ toast.message }}</span>
      <button v-if="toast.action" type="button" class="btn btn--small" @click="toast.action.run(); dismissToast(toast.id)">{{ toast.action.label }}</button>
      <button type="button" class="toast__close" aria-label="Dismiss notification" @click="dismissToast(toast.id)">✕</button>
    </div>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  z-index: var(--layer-toast);
  top: calc(var(--safe-top) + 64px);
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  gap: var(--space-2);
  width: min(420px, calc(100vw - 2 * var(--gutter)));
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line-gold);
  border-radius: var(--radius-md);
  background: var(--surface-panel);
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-float);
  animation: drop var(--motion-base) var(--ease-out);
}
.toast--error { border-color: var(--color-danger); }
.toast--success { border-color: var(--color-mint); }
.toast--love { border-color: var(--color-rose); }
.toast__text { flex: 1; font-size: var(--text-sm); overflow-wrap: anywhere; }
.toast__close { min-width: 32px; min-height: 32px; border: 0; background: transparent; color: var(--color-ink-muted); }
@keyframes drop { from { transform: translateY(-8px); opacity: 0; } to { transform: none; opacity: 1; } }
</style>
