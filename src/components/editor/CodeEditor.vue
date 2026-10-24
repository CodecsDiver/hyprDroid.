<script setup lang="ts">
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/editor/edcore.main'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { emitJuice } from '../../juice/juiceBus'
import { useComboStore } from '../../stores/comboStore'
import { useThemeStore } from '../../stores/themeStore'
import { resolveToken } from '../../theme/applyTheme'
import { buildMonacoTheme } from '../../theme/monacoTheme'

const props = defineProps<{
  modelValue: string
  readOnly?: boolean
  fontSize?: number
  /** Combo meter, particles and sound on keystrokes. Off in the typing lab. */
  effects?: boolean
  /** Typing-practice mode: no pasting, no auto-indent, so the student types every character. */
  plainTyping?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: []
  run: []
  check: []
  palette: []
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
let lineMarks: monaco.editor.IEditorDecorationsCollection | undefined

const themeStore = useThemeStore()

function applyEditorTheme(): void {
  monaco.editor.defineTheme(REALM_THEME, buildMonacoTheme(themeStore.overrides))
  monaco.editor.setTheme(REALM_THEME)
}
applyEditorTheme()

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
    fontFamily: resolveToken('fontEditor', themeStore.overrides),
    fontSize: props.fontSize ?? 15,
    lineHeight: Math.round((props.fontSize ?? 15) * 1.6),
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
    autoIndent: props.plainTyping ? 'none' : 'advanced',
    detectIndentation: false,
    insertSpaces: true,
    tabSize: 4,
  })

  if (props.plainTyping) {
    for (const eventName of ['paste', 'drop'] as const) {
      container.value!.addEventListener(eventName, (event) => event.preventDefault(), true)
    }
    // Monaco can also paste through its own clipboard commands, so neutralise the keys and undo anything that lands.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => undefined)
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Insert, () => undefined)
    editor.onDidPaste(() => editor?.trigger('plain-typing', 'undo', null))
  }
  lineMarks = editor.createDecorationsCollection()

  editor.onDidChangeModelContent((change) => {
    if (isApplyingExternalValue) return
    emit('update:modelValue', editor!.getValue())
    if (change.isFlush || props.effects === false) return
    combo.registerKeystroke()
    emitKeystrokeBurst()
  })

  const { KeyMod, KeyCode } = monaco
  editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, () => emit('save'))
  editor.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, () => emit('run'))
  editor.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Enter, () => emit('check'))
  // Replace Monaco's own palette with the app's.
  editor.addCommand(KeyCode.F1, () => emit('palette'))
  editor.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyP, () => emit('palette'))
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

watch(
  () => themeStore.overrides,
  () => {
    applyEditorTheme()
    editor?.updateOptions({ fontFamily: resolveToken('fontEditor', themeStore.overrides) })
  },
)

watch(
  () => props.readOnly,
  (readOnly) => editor?.updateOptions({ readOnly: readOnly ?? false }),
)

watch(
  () => props.fontSize,
  (size) => {
    if (size) editor?.updateOptions({ fontSize: size, lineHeight: Math.round(size * 1.6) })
  },
)

defineExpose({
  focus: () => editor?.focus(),
  setLineMarks: (marks: Array<{ line: number; kind: 'ok' | 'bad' }>) => {
    lineMarks?.set(
      marks.map((mark) => ({
        range: new monaco.Range(mark.line, 1, mark.line, 1),
        options: { isWholeLine: true, className: `lab-line-${mark.kind}` },
      })),
    )
  },
  runAction: (actionId: string) => {
    editor?.focus()
    editor?.trigger('menu', actionId, null)
  },
})

onBeforeUnmount(() => editor?.dispose())
</script>

<template>
  <div ref="container" class="code-editor" />
</template>

<style scoped>
.code-editor { width: 100%; height: 100%; }
</style>
