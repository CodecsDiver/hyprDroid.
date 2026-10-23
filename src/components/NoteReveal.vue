<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { playSfx } from '@/audio/engine'
import { markRead } from '@/data/repos/notes'
import type { HiddenNote } from '@/domain/notes'
import { reducedMotion } from '@/state/prefs'
import { partnerName } from '@/state/household'
import { refreshNotes } from '@/state/notes'
import { useAction } from '@/state/useAsync'
import { getInteraction } from '@/registry/interactionRegistry'

const props = defineProps<{ note: HiddenNote; remaining: number }>()
const emit = defineEmits<{ close: [] }>()

const opened = ref(props.note.reveal === 'none' || reducedMotion.value)
const where = computed(() => getInteraction(props.note.objectId)?.label ?? 'the room')
const animation = computed(() => (reducedMotion.value ? 'none' : props.note.reveal))

const open = useAction(async () => {
  opened.value = true
  playSfx(props.note.reveal === 'spell' ? 'glass' : 'open')
  await markRead(props.note.id)
  await refreshNotes()
})

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}
let dialog: HTMLElement | null = null
const dialogRef = ref<HTMLElement | null>(null)
onMounted(() => {
  document.addEventListener('keydown', onKey)
  dialog = dialogRef.value
  dialog?.focus()
  if (opened.value) void open.run()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="reveal" @pointerdown.self="emit('close')">
    <div ref="dialogRef" class="reveal__card" :class="`reveal--${animation}`" role="dialog" aria-label="Hidden note" aria-modal="true" tabindex="-1">
      <p class="reveal__where">Found on the {{ where.toLowerCase() }}<span v-if="note.openWhen"> · open when {{ note.openWhen.toLowerCase() }}</span></p>
      <template v-if="!opened">
        <div class="reveal__envelope" aria-hidden="true">✉️</div>
        <p>{{ partnerName }} left you something.</p>
        <button type="button" class="btn btn--primary" @click="open.run()">Open it</button>
      </template>
      <template v-else>
        <p class="reveal__from">A note from {{ partnerName }}</p>
        <p class="reveal__body">{{ note.body }}</p>
        <button type="button" class="btn" @click="emit('close')">{{ remaining > 0 ? `${remaining} more waiting` : 'Close' }}</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.reveal { position: absolute; inset: 0; z-index: var(--layer-modal); display: grid; place-items: center; padding: var(--gutter); background: var(--surface-scrim); }
.reveal__card { width: min(440px, 100%); max-height: 80dvh; overflow-y: auto; display: grid; gap: var(--space-3); justify-items: center; text-align: center; padding: var(--space-5); border: 1px solid var(--line-gold); border-radius: var(--radius-lg); background: var(--surface-panel); box-shadow: var(--shadow-panel); }
.reveal__card:focus { outline: none; }
.reveal__where { margin: 0; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-ink-faint); }
.reveal__envelope { font-size: 4rem; }
.reveal__from { margin: 0; color: var(--color-rose-soft); }
.reveal__body { margin: 0; font-family: var(--font-serif); font-size: var(--text-lg); line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
.reveal--fade .reveal__body { animation: fade-in 1.4s ease both; }
.reveal--envelope .reveal__envelope { animation: wobble 1.2s ease-in-out infinite; }
.reveal--envelope .reveal__body { animation: unfold 0.9s var(--ease-spring) both; transform-origin: top; }
.reveal--sparkle .reveal__body { animation: fade-in 1.1s ease both, glow 2s ease-in-out infinite alternate; }
.reveal--spell .reveal__body { animation: fade-in 1.6s ease both, spell 3s ease-in-out infinite alternate; color: var(--color-spell); }
@keyframes fade-in { from { opacity: 0; filter: blur(6px); } to { opacity: 1; filter: none; } }
@keyframes wobble { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
@keyframes unfold { from { transform: scaleY(0.1); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes glow { from { text-shadow: 0 0 4px rgba(255, 232, 163, 0.2); } to { text-shadow: 0 0 22px rgba(255, 232, 163, 0.8); } }
@keyframes spell { from { text-shadow: 0 0 6px rgba(201, 167, 255, 0.3); } to { text-shadow: 0 0 26px rgba(201, 167, 255, 0.9); } }
</style>
