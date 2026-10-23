<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { playSfx } from '@/audio/engine'

const props = withDefaults(defineProps<{ title: string; icon?: string; theme?: 'default' | 'spell'; fullscreen?: boolean; bare?: boolean }>(), {
  icon: '', theme: 'default', fullscreen: false, bare: false,
})
const emit = defineEmits<{ close: [] }>()

const titleId = useId()
const root = ref<HTMLElement | null>(null)
let opener: HTMLElement | null = null

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    event.preventDefault()
    emit('close')
  }
}

onMounted(async () => {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  playSfx('open')
  document.addEventListener('keydown', onKey)
  await nextTick()
  root.value?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  playSfx('close')
  if (opener && document.contains(opener)) opener.focus({ preventScroll: true })
})
</script>

<template>
  <!-- Non-modal dialog: the room behind stays visible and tappable. Escape closes; focus returns to the opener. -->
  <section
    ref="root"
    class="panel"
    :class="[props.theme === 'spell' ? 'theme-spell' : '', props.fullscreen ? 'panel--fullscreen' : '', props.bare ? 'panel--bare' : '']"
    role="dialog"
    aria-modal="false"
    :aria-labelledby="titleId"
    tabindex="-1"
  >
    <h2 v-if="bare" :id="titleId" class="visually-hidden">{{ title }}</h2>
    <header v-else class="panel__header">
      <h2 :id="titleId" class="panel__title"><span v-if="icon" aria-hidden="true">{{ icon }}</span> {{ title }}</h2>
      <button type="button" class="btn btn--small btn--quiet panel__close" aria-label="Close" @click="emit('close')">✕</button>
    </header>
    <div class="panel__body" :class="{ 'panel__body--bare': bare }"><slot /></div>
  </section>
</template>

<style scoped>
.panel {
  position: absolute;
  z-index: var(--layer-panel);
  left: var(--safe-left);
  right: var(--safe-right);
  bottom: 0;
  display: flex;
  flex-direction: column;
  max-height: min(78dvh, 760px);
  border: 1px solid var(--line-gold);
  border-bottom: 0;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--surface-panel);
  backdrop-filter: blur(16px);
  box-shadow: var(--shadow-panel);
  padding-bottom: var(--safe-bottom);
  animation: rise var(--motion-base) var(--ease-out);
}
.panel:focus {
  outline: none;
}
.panel--fullscreen {
  inset: 0;
  max-height: none;
  border-radius: 0;
  border: 0;
  padding-top: var(--safe-top);
}
.panel--bare {
  background: transparent;
  border: 0;
  backdrop-filter: none;
  box-shadow: none;
}
.panel__body.panel__body--bare {
  padding: 0;
  height: 100%;
}
.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4) var(--space-2);
}
.panel__title {
  font-size: var(--text-lg);
  color: var(--color-gold);
}
.panel__body {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-2) var(--space-4) var(--space-5);
  -webkit-overflow-scrolling: touch;
}
@media (min-width: 760px) {
  .panel:not(.panel--fullscreen) {
    left: auto;
    right: calc(var(--space-4) + var(--safe-right));
    top: calc(var(--safe-top) + 72px);
    bottom: calc(var(--safe-bottom) + 84px); /* keep clear of the bottom bar */
    width: 430px;
    max-height: none;
    border-bottom: 1px solid var(--line-gold);
    border-radius: var(--radius-lg);
    padding-bottom: 0;
  }
}
@keyframes rise {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: none; opacity: 1; }
}
</style>
