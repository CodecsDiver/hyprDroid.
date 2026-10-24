<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { isNativeRuntime } from '../../backend/backend'
import { onWebPythonStatus, type WebPythonStatus } from '../../runtime/webPython'
import { useWorkspaceStore } from '../../stores/workspaceStore'

type Tone = 'normal' | 'dim' | 'error' | 'warn'
interface Segment {
  text: string
  tone: Tone
}

const RESULT_MARKER = '@@PYDISC'

const workspace = useWorkspaceStore()
const webStatus = ref<WebPythonStatus>('idle')
const webFailure = ref('')
const stopWebStatus = isNativeRuntime()
  ? undefined
  : onWebPythonStatus((status, failure) => {
      webStatus.value = status
      webFailure.value = failure
    })
onBeforeUnmount(() => stopWebStatus?.())

const isolationChip = computed(() => {
  const view = workspace.output
  if (view.kind !== 'run' && view.kind !== 'check') return null
  switch (view.outcome.isolation) {
    case 'bubblewrap':
      return { text: 'SANDBOXED (bubblewrap)', tone: 'ok' }
    case 'wasm':
      return { text: 'SANDBOXED (WebAssembly, no network)', tone: 'ok' }
    default:
      return { text: 'UNSANDBOXED - full user access', tone: 'warn' }
  }
})

const statusChip = computed(() => {
  const view = workspace.output
  if (view.kind !== 'run' && view.kind !== 'check') return null
  if (view.outcome.timedOut) return { text: 'TIMED OUT after 10 s', tone: 'bad' }
  if (view.kind === 'check') return null
  return view.outcome.exitCode === 0
    ? { text: 'EXIT 0', tone: 'ok' }
    : { text: `EXIT ${view.outcome.exitCode ?? '?'}`, tone: 'bad' }
})

const segments = computed<Segment[]>(() => {
  const view = workspace.output
  switch (view.kind) {
    case 'empty':
      if (webStatus.value === 'failed') {
        return [{ text: `Python could not start in this browser: ${webFailure.value}\nUse the red chip at the top to retry, or use a current Chrome/Edge/Firefox (114+).`, tone: 'error' }]
      }
      if (webStatus.value === 'booting') {
        return [{ text: 'Loading Python (first time downloads about 10 MB, then it is cached)...', tone: 'dim' }]
      }
      return [{ text: 'Write code, then Run it or press Check my work. Nothing executes until you do.', tone: 'dim' }]
    case 'error':
      return [{ text: `[${view.error.code}] ${view.error.message}`, tone: 'error' }]
    case 'run': {
      const { stdout, stderr, outputTruncated } = view.outcome
      const parts: Segment[] = []
      if (stdout) parts.push({ text: stdout, tone: 'normal' })
      if (stderr) parts.push({ text: stderr, tone: 'error' })
      if (!stdout && !stderr) parts.push({ text: '(no output)', tone: 'dim' })
      if (outputTruncated) parts.push({ text: '\n[output truncated at 64 KB]', tone: 'warn' })
      return parts
    }
    case 'check': {
      const { stdout, stderr } = view.outcome
      if (!view.reported) {
        return [
          { text: 'The checks could not report. Your file probably has a syntax error, runs forever, or exits early.\n', tone: 'error' },
          { text: stderr + stdout, tone: 'error' },
        ]
      }
      const printed = stdout.split(RESULT_MARKER)[0].trim()
      return [
        { text: 'Objective results are shown in the Missions panel.', tone: 'dim' },
        ...(printed ? [{ text: `\n\nYour code printed:\n${printed}`, tone: 'normal' as Tone }] : []),
      ]
    }
  }
})
</script>

<template>
  <div class="output">
    <div class="output-bar">
      <span class="panel-title-inline">OUTPUT</span>
      <span v-if="statusChip" class="chip" :class="statusChip.tone">{{ statusChip.text }}</span>
      <span v-if="isolationChip" class="chip" :class="isolationChip.tone">{{ isolationChip.text }}</span>
      <span v-if="workspace.isBusy" class="chip busy">{{ workspace.isChecking ? 'VERIFYING OBJECTIVES' : 'RUNNING' }}</span>
    </div>
    <pre class="body"><span v-for="(segment, index) in segments" :key="index" :class="segment.tone">{{ segment.text }}</span></pre>
  </div>
</template>

<style scoped>
.output { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.output-bar { display: flex; align-items: center; gap: 10px; padding: 6px 14px; border-bottom: 1px solid rgb(var(--neon-cyan-rgb) / 0.12); }
.panel-title-inline { font-family: var(--font-display); font-size: 10px; letter-spacing: 0.25em; color: var(--neon-cyan); }
.chip { font-size: 10px; letter-spacing: 0.14em; padding: 2px 8px; border: 1px solid; }
.chip.ok { color: var(--neon-green); border-color: var(--neon-green); }
.chip.bad { color: var(--neon-red); border-color: var(--neon-red); }
.chip.warn { color: var(--neon-amber); border-color: var(--neon-amber); }
.chip.busy { color: var(--neon-cyan); border-color: var(--neon-cyan); animation: blink 0.8s step-end infinite; }
@keyframes blink { 50% { opacity: 0.4; } }
.body {
  flex: 1; margin: 0; padding: 10px 14px; overflow: auto;
  font-family: var(--font-ui); font-size: 13px; line-height: 1.55; white-space: pre-wrap;
  user-select: text; -webkit-user-select: text; color: var(--text);
}
.dim { color: var(--text-dim); }
.error { color: var(--neon-red); }
.warn { color: var(--neon-amber); }
</style>
