<script setup lang="ts">
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/editor/edcore.main'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { emitJuice } from '../../juice/juiceBus'
import { useComboStore } from '../../stores/comboStore'

const props = defineProps<{ modelValue: string; readOnly?: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: []
  run: []
  check: []
}>()

;(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

const REALM_THEME = 'realm-neon'
const combo = useComboStore()
const container = ref<HTMLDivElement>()
let editor: monaco.editor.IStandaloneCodeEditor | undefined
let isApplyingExternalValue = false
let lastBurstAt = 0

monaco.editor.defineTheme(REALM_THEME, {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '5b7a8c', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'a45cff', fontStyle: 'bold' },
    { token: 'string', foreground: '39ff88' },
    { token: 'number', foreground: 'ffc83d' },
    { token: 'identifier', foreground: 'dbe8f5' },
    { token: 'delimiter', foreground: '19e6ff' },
    { token: 'type.identifier', foreground: '19e6ff' },
  ],
  colors: {
    'editor.background': '#060912',
    'editor.foreground': '#dbe8f5',
    'editor.lineHighlightBackground': '#101a2e',
    'editor.selectionBackground': '#19e6ff44',
    'editorCursor.foreground': '#39ff88',
    'editorLineNumber.foreground': '#3b4d66',
    'editorLineNumber.activeForeground': '#19e6ff',
    'editorIndentGuide.background1': '#142036',
    'editorIndentGuide.activeBackground1': '#19e6ff66',
    'editorGutter.background': '#060912',
    'scrollbarSlider.background': '#19e6ff33',
    'scrollbarSlider.hoverBackground': '#19e6ff66',
  },
})

function emitKeystrokeBurst(): void {
  const now = performance.now()
  if (!editor || !container.value || now - lastBurstAt < 35) return
  const position = editor.getPosition()
  const visible = position && editor.getScrolledVisiblePosition(position)
  if (!visible) return
  lastBurstAt = now
  const bounds = container.value.getBoundingClientRect()
  emitJuice({
    kind: 'keystroke',
    x: bounds.left + visible.left,
    y: bounds.top + visible.top + visible.height / 2,
    combo: combo.combo,
  })
}

onMounted(() => {
  editor = monaco.editor.create(container.value!, {
    value: props.modelValue,
    language: 'python',
    theme: REALM_THEME,
    readOnly: props.readOnly,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'DejaVu Sans Mono', monospace",
    fontSize: 15,
    lineHeight: 24,
    fontLigatures: true,
    minimap: { enabled: false },
    automaticLayout: true,
    smoothScrolling: true,
    cursorBlinking: 'expand',
    cursorSmoothCaretAnimation: 'on',
    cursorWidth: 3,
    renderLineHighlight: 'all',
    scrollBeyondLastLine: false,
    padding: { top: 14, bottom: 14 },
    bracketPairColorization: { enabled: true },
    guides: { indentation: true, bracketPairs: true },
    // Learning mode: the student types every line, so every assist is off.
    quickSuggestions: false,
    suggestOnTriggerCharacters: false,
    wordBasedSuggestions: 'off',
    acceptSuggestionOnEnter: 'off',
    acceptSuggestionOnCommitCharacter: false,
    tabCompletion: 'off',
    snippetSuggestions: 'none',
    parameterHints: { enabled: false },
    hover: { enabled: false },
    inlineSuggest: { enabled: false },
    lightbulb: { enabled: monaco.editor.ShowLightbulbIconMode.Off },
    codeLens: false,
    occurrencesHighlight: 'off',
    selectionHighlight: false,
    matchBrackets: 'always',
    autoClosingBrackets: 'never',
    autoClosingQuotes: 'never',
    autoSurround: 'never',
    formatOnType: false,
    formatOnPaste: false,
    links: false,
    contextmenu: false,
  })

  editor.onDidChangeModelContent((change) => {
    if (isApplyingExternalValue) return
    emit('update:modelValue', editor!.getValue())
    if (change.isFlush) return
    combo.registerKeystroke()
    emitKeystrokeBurst()
  })

  const { KeyMod, KeyCode } = monaco
  editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, () => emit('save'))
  editor.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, () => emit('run'))
  editor.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Enter, () => emit('check'))
  editor.focus()
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor || editor.getValue() === value) return
    isApplyingExternalValue = true
    editor.setValue(value)
    isApplyingExternalValue = false
  },
)

defineExpose({ focus: () => editor?.focus() })

onBeforeUnmount(() => editor?.dispose())
</script>

<template>
  <div ref="container" class="code-editor" />
</template>

<style scoped>
.code-editor { width: 100%; height: 100%; }
</style>
