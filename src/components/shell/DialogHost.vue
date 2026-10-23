<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AppCommand } from '../../commands/commandRegistry'
import { APP_COMMANDS_KEY } from '../../commands/injection'
import { isNativeRuntime } from '../../backend/backend'
import { useUiStore } from '../../stores/uiStore'

const ui = useUiStore()
const appVersion = __APP_VERSION__
const commands = inject(APP_COMMANDS_KEY, [] as AppCommand[])
const promptValue = ref('')
const promptInput = ref<HTMLInputElement>()
const promptError = computed(() => (ui.dialog?.kind === 'prompt' ? ui.dialog.validate(promptValue.value) : null))
watch(
  () => ui.dialog,
  async (dialog) => {
    if (dialog?.kind !== 'prompt') return
    promptValue.value = dialog.initial
    await nextTick()
    promptInput.value?.focus()
    promptInput.value?.select()
  },
)
const shortcutRows = computed(() => commands.filter((command) => command.shortcuts?.length))

function onKeydown(event: KeyboardEvent): void {
  if (!ui.dialog) return
  if (event.key === 'Escape') ui.closeDialog(false)
  if (event.key === 'Enter' && ui.dialog.kind === 'confirm') ui.closeDialog(true)
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="ui.dialog" class="scrim" role="dialog" aria-modal="true" @mousedown.self="ui.closeDialog(false)">
    <div v-if="ui.dialog.kind === 'confirm'" class="dialog panel">
      <div class="panel-title">{{ ui.dialog.title }}</div>
      <div class="content">
        <p>{{ ui.dialog.message }}</p>
        <div class="actions">
          <button class="btn is-ghost" @click="ui.closeDialog(false)">Cancel</button>
          <button class="btn is-amber" @click="ui.closeDialog(true)">{{ ui.dialog.confirmLabel }}</button>
        </div>
      </div>
    </div>

    <div v-else-if="ui.dialog.kind === 'prompt'" class="dialog panel">
      <div class="panel-title">{{ ui.dialog.title }}</div>
      <div class="content">
        <label class="field">
          <span class="field-label">{{ ui.dialog.label }}</span>
          <input
            ref="promptInput"
            v-model="promptValue"
            class="text-input"
            type="text"
            spellcheck="false"
            autocomplete="off"
            @keydown.enter.prevent="ui.submitPrompt(promptValue)"
          />
        </label>
        <p class="field-error">{{ promptError ?? '' }}</p>
        <div class="actions">
          <button class="btn is-ghost" @click="ui.closeDialog(false)">Cancel</button>
          <button class="btn is-green" :disabled="promptError !== null" @click="ui.submitPrompt(promptValue)">{{ ui.dialog.confirmLabel }}</button>
        </div>
      </div>
    </div>

    <div v-else-if="ui.dialog.kind === 'about'" class="dialog panel">
      <div class="panel-title">About Python Discovery</div>
      <div class="content">
        <p>A local-first, gamified Python learning editor. You write every line; only verified objectives earn XP.</p>
        <p class="dim">Version {{ appVersion }} &middot; {{ isNativeRuntime() ? 'Desktop app (system Python in bubblewrap)' : 'Web app (Python in WebAssembly)' }}</p>
        <div class="actions"><button class="btn is-ghost" @click="ui.closeDialog(false)">Close</button></div>
      </div>
    </div>

    <div v-else class="dialog panel wide">
      <div class="panel-title">Keyboard shortcuts</div>
      <div class="content">
        <table>
          <tr v-for="command in shortcutRows" :key="command.id">
            <td>{{ command.category }}: {{ command.title }}</td>
            <td class="keys">{{ command.shortcuts?.join('  /  ') }}</td>
          </tr>
        </table>
        <p class="dim">In Firefox, Ctrl+Shift+P may open a private window; use F1 or the Command palette button instead.</p>
        <div class="actions"><button class="btn is-ghost" @click="ui.closeDialog(false)">Close</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrim { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; background: rgba(4, 5, 10, 0.75); }
.dialog { width: 480px; max-width: 92vw; background: var(--hull-raised); }
.dialog.wide { width: 620px; }
.content { padding: 16px 20px 20px; line-height: 1.6; max-height: 70vh; overflow: auto; }
.content p { margin: 0 0 12px; }
.dim { color: var(--text-dim); font-size: 12px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-dim); }
.text-input {
  padding: 10px 12px; font-family: inherit; font-size: 15px; color: var(--text); background: rgba(4, 5, 10, 0.85);
  border: 1px solid var(--glass-edge); outline: none; user-select: text; -webkit-user-select: text;
}
.text-input:focus { border-color: var(--neon-cyan); box-shadow: var(--glow-cyan); }
.field-error { min-height: 18px; margin: 6px 0 0; font-size: 12px; color: var(--neon-red); }
.actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }
table { width: 100%; border-collapse: collapse; }
td { padding: 5px 0; border-bottom: 1px solid rgba(113, 134, 160, 0.15); }
.keys { text-align: right; color: var(--neon-cyan); white-space: nowrap; }
</style>
