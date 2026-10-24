<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  /** The line to type, without its leading indentation (that is filled in for you). */
  target: string
  indent: number
  active: boolean
}>()
const emit = defineEmits<{
  done: []
  /** One wrong character was typed. */
  mistake: []
}>()

const typed = ref('')
const isDone = ref(false)
const input = ref<HTMLInputElement>()

const characters = computed(() =>
  Array.from(props.target).map((character, index) => ({
    character,
    state: index >= typed.value.length ? 'todo' : typed.value[index] === character ? 'ok' : 'bad',
  })),
)
const overflow = computed(() => typed.value.slice(props.target.length))

watch(
  () => props.target,
  () => {
    typed.value = ''
    isDone.value = false
    if (input.value) input.value.value = ''
  },
  { immediate: true },
)

watch(
  () => props.active,
  async (active) => {
    if (!active) return
    await nextTick()
    input.value?.focus()
  },
  { immediate: true },
)

function onInput(event: Event): void {
  if (isDone.value || !props.active) return
  const value = (event.target as HTMLInputElement).value
  if (value.length > typed.value.length) {
    const position = value.length - 1
    if (position >= props.target.length || value[position] !== props.target[position]) emit('mistake')
  }
  typed.value = value
  if (value === props.target) {
    isDone.value = true
    emit('done')
  }
}

const focus = () => input.value?.focus()
defineExpose({ focus })
</script>

<template>
  <div class="typer" :class="{ active, done: isDone }" @mousedown.prevent="focus">
    <span class="indent" aria-hidden="true">{{ ' '.repeat(indent) }}</span>
    <span class="text">
      <span
        v-for="(entry, index) in characters"
        :key="index"
        class="ch"
        :class="[entry.state, { caret: active && index === typed.length }]"
      >{{ entry.character }}</span>
      <span v-for="(extra, index) in overflow" :key="`x${index}`" class="ch bad">{{ extra }}</span>
      <span v-if="active && typed.length >= target.length && !isDone" class="ch caret end">&nbsp;</span>
    </span>
    <input
      ref="input"
      class="capture"
      type="text"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      :disabled="!active || isDone"
      aria-label="Type the highlighted line"
      @input="onInput"
      @paste.prevent
      @drop.prevent
    />
  </div>
</template>

<style scoped>
.typer { position: relative; display: flex; white-space: pre; font-family: var(--font-editor); font-size: 18px; line-height: 1.7; cursor: text; }
.indent { color: transparent; }
.ch { transition: color 0.05s; }
.ch.todo { color: rgb(var(--text-dim-rgb) / 0.9); }
.ch.ok { color: var(--neon-green); text-shadow: 0 0 calc(8px * var(--fx-scale)) rgb(var(--neon-green-rgb) / 0.6); }
.ch.bad { color: var(--flash); background: rgb(var(--neon-red-rgb) / 0.55); }
.ch.caret { box-shadow: -2px 0 0 var(--neon-cyan); animation: caret-blink 1s steps(2) infinite; }
.ch.caret.end { box-shadow: 2px 0 0 var(--neon-cyan); }
.capture { position: absolute; inset: 0; width: 100%; opacity: 0; cursor: text; }
@keyframes caret-blink { 50% { box-shadow-color: transparent; } }
:root[data-fx='off'] .ch.caret { animation: none; }
</style>
