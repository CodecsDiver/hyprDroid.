<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue'
import { searchCommands, type AppCommand } from '../../commands/commandRegistry'
import { APP_COMMANDS_KEY } from '../../commands/injection'
import { useUiStore } from '../../stores/uiStore'

const ui = useUiStore()
const commands = inject(APP_COMMANDS_KEY, [] as AppCommand[])

const query = ref('')
const highlightedIndex = ref(0)
const input = ref<HTMLInputElement>()
const list = ref<HTMLElement>()

const results = computed(() => {
  const matches = searchCommands(commands, query.value)
  return matches.filter((command) => !command.isEnabled || command.isEnabled())
})

watch(() => ui.isPaletteOpen, async (isOpen) => {
  if (!isOpen) return
  query.value = ''
  highlightedIndex.value = 0
  await nextTick()
  input.value?.focus()
})
watch(query, () => (highlightedIndex.value = 0))

function run(command: AppCommand): void {
  ui.closePalette()
  // Let the palette unmount first so focus returns to wherever the command expects it.
  setTimeout(() => void command.run(), 0)
}

function scrollHighlightedIntoView(): void {
  nextTick(() => list.value?.querySelector('.highlighted')?.scrollIntoView({ block: 'nearest' }))
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    ui.closePalette()
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    highlightedIndex.value = (highlightedIndex.value + 1) % Math.max(results.value.length, 1)
    scrollHighlightedIntoView()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlightedIndex.value = (highlightedIndex.value - 1 + results.value.length) % Math.max(results.value.length, 1)
    scrollHighlightedIntoView()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const command = results.value[highlightedIndex.value]
    if (command) run(command)
  }
}
</script>

<template>
  <div v-if="ui.isPaletteOpen" class="scrim" @mousedown.self="ui.closePalette()">
    <div class="palette panel" role="dialog" aria-label="Command palette">
      <input
        ref="input"
        v-model="query"
        class="search"
        type="text"
        placeholder="Type a command...  (try: run, focus, mission, zoom)"
        spellcheck="false"
        autocomplete="off"
        @keydown="onKeydown"
      />
      <ul ref="list" class="results" role="listbox">
        <li
          v-for="(command, index) in results"
          :key="command.id"
          class="result"
          :class="{ highlighted: index === highlightedIndex }"
          role="option"
          @mouseenter="highlightedIndex = index"
          @mousedown.prevent="run(command)"
        >
          <span class="category">{{ command.category }}</span>
          <span class="title">{{ command.title }}</span>
          <span v-if="command.isChecked" class="state">{{ command.isChecked() ? 'on' : 'off' }}</span>
          <span class="shortcut">{{ command.shortcuts?.join('  ·  ') ?? '' }}</span>
        </li>
        <li v-if="results.length === 0" class="empty">No matching command</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.scrim { position: fixed; inset: 0; z-index: 95; display: flex; justify-content: center; align-items: flex-start; padding-top: 12vh; background: rgba(4, 5, 10, 0.55); }
.palette { width: min(680px, 92vw); background: var(--hull-raised); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.8), var(--glow-cyan); }
.search {
  width: 100%; padding: 14px 18px; font-family: inherit; font-size: 15px; color: var(--text); background: rgba(4, 5, 10, 0.8);
  border: 0; border-bottom: 1px solid rgba(25, 230, 255, 0.3); outline: none; user-select: text; -webkit-user-select: text;
}
.results { list-style: none; margin: 0; padding: 6px 0; max-height: 52vh; overflow: auto; }
.result { display: grid; grid-template-columns: 62px 1fr auto auto; gap: 12px; align-items: center; padding: 8px 18px; cursor: pointer; }
.result.highlighted { background: rgba(25, 230, 255, 0.18); box-shadow: inset 3px 0 0 var(--neon-cyan); }
.category { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--neon-violet); }
.title { color: var(--text); }
.state { font-size: 10px; color: var(--neon-green); text-transform: uppercase; letter-spacing: 0.12em; }
.shortcut { font-size: 11px; color: var(--text-dim); }
.empty { padding: 16px 18px; color: var(--text-dim); }
</style>
