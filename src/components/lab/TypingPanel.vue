<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { readProjectFile, runPython, toBackendError, writeProjectFile, type BackendError, type RunOutcome } from '../../backend/backend'
import { formatDelta, formatMs, ghostTextAt, RunRecorder, type GhostVerdict } from '../../ghost/ghostRecord'
import { emitJuice } from '../../juice/juiceBus'
import { usePracticeStore } from '../../stores/practiceStore'
import CodeEditor from '../editor/CodeEditor.vue'
import CountdownBanner from '../shell/CountdownBanner.vue'
import { LINES_PER_CHUNK, chunkCount, chunkLines, evaluateTyping, splitCode } from '../../lab/typingCourse'
import type { LabCourse } from '../../lab/courses'
import { TRACE_RUNNER_FILE_NAME, buildTraceRunnerSource, parseTraceOutput } from '../../lab/traceRunner'
import type { SortFrame } from '../../visualizers/algorithms/sorting'

const props = defineProps<{ course: LabCourse; fontSize: number; /** Racing this course's ghost in a separate practice file. */ race?: boolean }>()
const emit = defineEmits<{
  /** The typed file for this course is (or stopped being) completely correct. */
  completion: [courseId: string, isComplete: boolean]
  /** Run finished. `matched` = output equals the expected output; `frames` = steps recorded from the student's own code. */
  ran: [result: { courseId: string; matched: boolean; frames: SortFrame[] | null }]
  /** The student left the race. */
  raceEnded: []
}>()

const FILE_NAME = 'main.py'
const AUTOSAVE_DELAY_MS = 600

const practice = usePracticeStore()
const folderFor = (courseId: string, racing: boolean) => (racing ? `ghost-lab-${courseId}` : `lab-${courseId}`)
const projectId = computed(() => folderFor(props.course.id, !!props.race))
/** The folder whose file is currently loaded, so switching courses or modes saves to the right place. */
let loadedFolder = ''
const expectedLines = computed(() => splitCode(props.course.code))
const totalChunks = computed(() => chunkCount(expectedLines.value.length))

const typedText = ref('')
const isLoaded = ref(false)
/** Which course's file is currently loaded, so a half-switched panel never reports the wrong course complete. */
const loadedCourseId = ref('')
const saveError = ref<BackendError | null>(null)
const runOutcome = ref<RunOutcome | null>(null)
const runError = ref<BackendError | null>(null)
const isRunning = ref(false)
const justUnlockedChunk = ref<number | null>(null)
const confirmingRestart = ref(false)
const editor = ref<InstanceType<typeof CodeEditor>>()
let saveTimer: ReturnType<typeof setTimeout> | undefined
let loadToken = 0
let previousUnlocked = 1

// --- timing and the ghost ---------------------------------------------------------------------------
type RacePhase = 'idle' | 'countdown' | 'racing' | 'done'
const ghostKey = computed(() => `lab:${props.course.id}`)
const racePhase = ref<RacePhase>('idle')
const raceNow = ref(Date.now())
const raceFinalMs = ref(0)
const raceVerdict = ref<GhostVerdict | null>(null)
const ghostTimeBefore = ref<number | null>(null)
const racedGhost = ref(practice.ghostFor(`lab:${props.course.id}`))
let recorder: RunRecorder | null = null
let raceTicker: ReturnType<typeof setInterval> | undefined

const yourMs = computed(() => (racePhase.value === 'done' ? raceFinalMs.value : raceNow.value >= 0 ? (recorder?.elapsed(raceNow.value) ?? 0) : 0))
const ghostMatchedLines = computed(() =>
  racedGhost.value ? evaluateTyping(expectedLines.value, ghostTextAt(racedGhost.value, yourMs.value)).matchedLines : 0,
)
const ghostFraction = computed(() => ghostMatchedLines.value / expectedLines.value.length)
const isEditorLocked = computed(() => !!props.race && racePhase.value !== 'racing')

function stopTicker(): void {
  clearInterval(raceTicker)
}

function beginRace(): void {
  racedGhost.value = practice.ghostFor(ghostKey.value)
  ghostTimeBefore.value = racedGhost.value?.ms ?? null
  raceVerdict.value = null
  recorder = null
  racePhase.value = 'countdown'
}

function goRace(): void {
  recorder = new RunRecorder('')
  racePhase.value = 'racing'
  raceNow.value = Date.now()
  stopTicker()
  raceTicker = setInterval(() => (raceNow.value = Date.now()), 100)
  editor.value?.focus()
}

/** Called once the whole file is typed correctly: stores the run as the ghost if it is the first or the fastest. */
function finishTimedRun(): void {
  const record = recorder?.finish(ghostKey.value, Date.now())
  recorder = null
  stopTicker()
  if (!record) return
  const verdict = practice.submitRun(record)
  if (props.race) {
    raceFinalMs.value = record.ms
    raceVerdict.value = verdict
    racePhase.value = 'done'
  }
  const beatGhost = ghostTimeBefore.value === null || record.ms < ghostTimeBefore.value
  if (verdict === 'slower' && !props.race) return
  emitJuice({
    kind: 'banner',
    tone: verdict === 'slower' ? 'cyan' : 'amber',
    headline: verdict === 'first' ? 'GHOST CREATED' : verdict === 'faster' ? (props.race ? 'YOU BEAT THE GHOST' : 'NEW GHOST: FASTER RUN') : 'THE GHOST WINS',
    detail: `${props.course.title}: ${formatMs(record.ms)}`,
  })
  if (verdict !== 'slower' && (beatGhost || !props.race)) emitJuice({ kind: 'celebrate', scale: props.race ? 2 : 1 })
}

const evaluation = computed(() => evaluateTyping(expectedLines.value, typedText.value))
/** The chunk being typed right now (zero-based). */
const activeChunk = computed(() => Math.min(evaluation.value.unlockedChunks, totalChunks.value) - 1)
const activeLines = computed(() => chunkLines(expectedLines.value, activeChunk.value))
const activeFirstLine = computed(() => activeChunk.value * LINES_PER_CHUNK + 1)
const progressFraction = computed(() => evaluation.value.matchedLines / expectedLines.value.length)

type LineState = 'done' | 'current' | 'pending' | 'bad'
function lineState(lineNumber: number): LineState {
  const result = evaluation.value
  if (lineNumber <= result.matchedLines) return 'done'
  if (result.mismatch && result.mismatch.line === lineNumber) return 'bad'
  if (lineNumber === result.matchedLines + 1) return 'current'
  return 'pending'
}

async function loadFile(): Promise<void> {
  const token = ++loadToken
  const courseId = props.course.id
  isLoaded.value = false
  clearTimeout(saveTimer)
  runOutcome.value = null
  runError.value = null
  saveError.value = null
  confirmingRestart.value = false
  stopTicker()
  racePhase.value = 'idle'
  recorder = null
  const folder = projectId.value
  try {
    // A race always starts from an empty file; a normal visit continues where the student left off.
    const stored = props.race ? null : await readProjectFile(folder, FILE_NAME)
    if (token !== loadToken) return
    typedText.value = stored ?? ''
    // Only a file that starts empty has an honest start time, so only those visits are timed.
    recorder = !props.race && typedText.value === '' ? new RunRecorder('') : null
    if (props.race) await writeProjectFile(folder, FILE_NAME, '')
  } catch (error) {
    if (token !== loadToken) return
    saveError.value = toBackendError(error)
    typedText.value = ''
  }
  previousUnlocked = evaluateTyping(expectedLines.value, typedText.value).unlockedChunks
  justUnlockedChunk.value = null
  loadedCourseId.value = courseId
  loadedFolder = folder
  isLoaded.value = true
  if (props.race) beginRace()
}

async function saveNow(forProjectId = projectId.value, text = typedText.value): Promise<void> {
  clearTimeout(saveTimer)
  try {
    await writeProjectFile(forProjectId, FILE_NAME, text)
    saveError.value = null
  } catch (error) {
    saveError.value = toBackendError(error)
  }
}

function onTyped(text: string): void {
  if (isEditorLocked.value) return
  typedText.value = text
  recorder?.change(text, Date.now())
  runOutcome.value = null
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, AUTOSAVE_DELAY_MS)
}

watch(
  () => [props.course.id, !!props.race] as const,
  async () => {
    // Flush the previous course's file into ITS folder before loading the new one.
    if (loadedFolder && isLoaded.value && !loadedFolder.startsWith('ghost-')) await saveNow(loadedFolder, typedText.value)
    await loadFile()
  },
  { immediate: true },
)

watch(
  () => evaluation.value.isComplete,
  (complete) => {
    if (complete && isLoaded.value && recorder) finishTimedRun()
  },
)

watch(
  () => evaluation.value.unlockedChunks,
  (unlocked) => {
    if (isLoaded.value && unlocked > previousUnlocked) {
      justUnlockedChunk.value = unlocked
      setTimeout(() => {
        if (justUnlockedChunk.value === unlocked) justUnlockedChunk.value = null
      }, 2600)
    }
    previousUnlocked = unlocked
  },
)

watch(
  () => evaluation.value.marks,
  async (marks) => {
    await nextTick()
    editor.value?.setLineMarks(marks)
  },
  { immediate: true },
)

watch(
  () => [isLoaded.value, loadedCourseId.value === props.course.id, evaluation.value.isComplete] as const,
  ([loaded, isCurrent, complete]) => {
    if (loaded && isCurrent && !props.race) emit('completion', props.course.id, complete)
  },
  { immediate: true },
)

/** Runs the student's file under a tracer and returns the steps their code really took, or null. */
async function traceOwnCode(): Promise<SortFrame[] | null> {
  if (!props.course.trace) return null
  try {
    await writeProjectFile(projectId.value, TRACE_RUNNER_FILE_NAME, buildTraceRunnerSource(props.course.trace))
    const traced = await runPython(projectId.value, TRACE_RUNNER_FILE_NAME, false)
    return parseTraceOutput(traced.stdout)
  } catch {
    return null
  }
}

async function run(): Promise<void> {
  isRunning.value = true
  runError.value = null
  try {
    await saveNow()
    const outcome = await runPython(projectId.value, FILE_NAME, false)
    runOutcome.value = outcome
    const matched = outcome.exitCode === 0 && !outcome.timedOut && outcome.stdout === props.course.expectedOutput
    const frames = await traceOwnCode()
    emit('ran', { courseId: props.course.id, matched, frames })
  } catch (error) {
    const backendError = toBackendError(error)
    runError.value = backendError.code === 'containment-unavailable'
      ? { code: backendError.code, message: 'No sandbox is available for running here. Install bubblewrap (sudo apt install bubblewrap) to run your file from the lab.' }
      : backendError
  } finally {
    isRunning.value = false
  }
}

async function restart(): Promise<void> {
  if (!confirmingRestart.value) {
    confirmingRestart.value = true
    setTimeout(() => (confirmingRestart.value = false), 3500)
    return
  }
  typedText.value = ''
  recorder = new RunRecorder('')
  confirmingRestart.value = false
  runOutcome.value = null
  previousUnlocked = 1
  await saveNow()
  editor.value?.focus()
}

onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  stopTicker()
  if (!props.race) void saveNow()
})
</script>

<template>
  <section class="typing panel">
    <header class="head">
      <div class="title">
        <span class="name">Type it: {{ course.title }}</span>
        <span class="part">Part {{ activeChunk + 1 }} of {{ totalChunks }}</span>
      </div>
      <div class="progress" :title="`${evaluation.matchedLines} of ${expectedLines.length} lines typed correctly`">
        <div class="progress-fill" :style="{ transform: `scaleX(${progressFraction})` }" />
      </div>
      <span class="lines">{{ evaluation.matchedLines }} / {{ expectedLines.length }} lines</span>
      <template v-if="race">
        <span class="race-clock">YOU <b>{{ formatMs(yourMs) }}</b></span>
        <span class="race-clock ghost">GHOST <b>{{ racedGhost ? formatMs(racedGhost.ms) : 'none yet' }}</b></span>
        <button class="btn is-ghost" @click="emit('raceEnded')">Leave race</button>
      </template>
      <template v-else>
        <span v-if="recorder" class="race-clock" title="Timed from your first keystroke. Finish the file and this run can become your ghost.">TIME <b>{{ formatMs(yourMs) }}</b></span>
        <button class="btn is-green" :disabled="!evaluation.isComplete || isRunning" @click="run">&#9654; {{ isRunning ? 'Running...' : 'Run & check my work' }}</button>
        <button class="btn is-ghost" @click="restart">{{ confirmingRestart ? 'Click again to wipe' : 'Start over' }}</button>
      </template>
    </header>
    <div v-if="race && racedGhost && racePhase === 'racing'" class="ghost-track" :title="`Ghost: ${ghostMatchedLines} of ${expectedLines.length} lines`">
      <i class="ghost-lines" :style="{ transform: `scaleX(${ghostFraction})` }" />
      <span>GHOST {{ ghostMatchedLines }} / {{ expectedLines.length }} lines &middot; YOU {{ evaluation.matchedLines }}</span>
    </div>

    <div class="body">
      <div class="reference" :class="{ 'just-unlocked': justUnlockedChunk !== null }">
        <div class="chips">
          <span
            v-for="index in totalChunks"
            :key="index"
            class="chip"
            :class="{ done: index - 1 < evaluation.completedChunks, active: index - 1 === activeChunk && !evaluation.isComplete, locked: index - 1 > activeChunk }"
          >{{ index - 1 < evaluation.completedChunks ? '✓' : index - 1 > activeChunk ? '🔒' : '▶' }} {{ index }}</span>
        </div>

        <div v-if="evaluation.isComplete" class="finished">
          <strong>Done: every line typed correctly.</strong>
          <span>Press Run &amp; check my work: the visualizer above will play what your code does.</span>
        </div>
        <template v-else>
          <div v-if="justUnlockedChunk !== null" class="unlocked-banner">NEXT PART UNLOCKED</div>
          <p class="instruction">Type these {{ activeLines.length }} lines into the file on the right. Indentation counts.</p>
          <ol class="code" :start="activeFirstLine">
            <li v-for="(line, index) in activeLines" :key="activeChunk + ':' + index" :class="lineState(activeFirstLine + index)">
              <span class="number">{{ activeFirstLine + index }}</span>
              <span class="text">{{ line === '' ? ' ' : line }}</span>
            </li>
          </ol>
          <div v-if="evaluation.mismatch" class="hint-bad">
            Line {{ evaluation.mismatch.line }} does not match.
            <div>expected <code>{{ evaluation.mismatch.expected }}</code></div>
            <div>you typed <code>{{ evaluation.mismatch.typed || '(empty)' }}</code></div>
          </div>
        </template>

        <div v-if="runError" class="run-box error">[{{ runError.code }}] {{ runError.message }}</div>
        <div v-else-if="runOutcome" class="run-box">
          <div class="verdict" :class="runOutcome.stdout === course.expectedOutput && runOutcome.exitCode === 0 ? 'pass' : 'fail'">{{ runOutcome.stdout === course.expectedOutput && runOutcome.exitCode === 0 ? '✓ Your output is correct' : '✗ Your output differs from the expected result' }}</div>
          <div class="run-title">OUTPUT</div>
          <pre>{{ runOutcome.stdout }}<span class="err">{{ runOutcome.stderr }}</span></pre>
        </div>
        <div v-if="saveError" class="run-box error">Could not save: {{ saveError.message }}</div>
      </div>

      <div class="editor">
        <CodeEditor
          v-if="isLoaded"
          :key="`${course.id}:${race ? 'race' : 'normal'}`"
          ref="editor"
          :model-value="typedText"
          :font-size="fontSize"
          :read-only="isEditorLocked"
          :effects="false"
          plain-typing
          @update:model-value="onTyped"
          @save="saveNow"
        />
      </div>
    </div>

    <div v-if="race && racePhase === 'done'" class="race-result">
      <div class="race-verdict" :class="{ win: raceVerdict !== 'slower' }">
        {{ raceVerdict === 'first' ? 'GHOST CREATED' : raceVerdict === 'faster' ? 'NEW RECORD' : 'THE GHOST HOLDS' }}
      </div>
      <div class="race-numbers">
        <span>Your time <b>{{ formatMs(raceFinalMs) }}</b></span>
        <span v-if="ghostTimeBefore !== null">Ghost was <b>{{ formatMs(ghostTimeBefore) }}</b> ({{ formatDelta(raceFinalMs - ghostTimeBefore) }})</span>
      </div>
      <div class="race-actions">
        <button class="btn is-ghost" @click="emit('raceEnded')">Back to the lesson</button>
        <button class="btn is-green" @click="loadFile()">Race again</button>
      </div>
    </div>
    <CountdownBanner :active="race === true && racePhase === 'countdown'" @go="goRace" />
  </section>
</template>

<style scoped>
.typing { display: flex; flex-direction: column; min-height: 0; height: 100%; background: rgb(var(--editor-bg-rgb) / 0.9); }
.head { display: flex; align-items: center; gap: 14px; padding: 8px 14px; border-bottom: 1px solid rgb(var(--neon-cyan-rgb) / 0.2); }
.title { display: flex; flex-direction: column; min-width: 190px; }
.name { font-weight: 700; color: var(--neon-cyan); }
.part { font-size: 10px; letter-spacing: 0.2em; color: var(--neon-amber); text-transform: uppercase; }
.progress { flex: 1; height: 8px; background: rgba(255, 255, 255, 0.08); }
.progress-fill { height: 100%; transform-origin: left; background: linear-gradient(90deg, var(--neon-green), var(--neon-cyan)); transition: transform 0.25s; }
.lines { font-size: 11px; color: var(--text-dim); white-space: nowrap; }
.body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(300px, 46%) 1fr; }
.reference { padding: 10px 14px; overflow: auto; border-right: 1px solid rgb(var(--neon-cyan-rgb) / 0.2); user-select: none; -webkit-user-select: none; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.chip { padding: 2px 8px; font-size: 11px; border: 1px solid rgb(var(--text-dim-rgb) / 0.4); color: var(--text-dim); }
.chip.done { color: var(--neon-green); border-color: var(--neon-green); }
.chip.active { color: var(--neon-amber); border-color: var(--neon-amber); box-shadow: 0 0 calc(10px * var(--fx-scale)) var(--neon-amber); }
.instruction { margin: 0 0 8px; color: var(--text-dim); font-size: 12px; }
.code { list-style: none; margin: 0; padding: 0; font-size: 14px; line-height: 1.55; }
.code li { display: grid; grid-template-columns: 36px 1fr; white-space: pre; padding-right: 8px; border-left: 3px solid transparent; }
.number { color: var(--text-dim); text-align: right; padding-right: 12px; }
.code li.done { background: rgb(var(--neon-green-rgb) / 0.1); border-left-color: var(--neon-green); color: var(--neon-green); }
.code li.current { background: rgb(var(--neon-amber-rgb) / 0.12); border-left-color: var(--neon-amber); color: var(--flash); }
.code li.bad { background: rgb(var(--neon-red-rgb) / 0.18); border-left-color: var(--neon-red); color: var(--flash); }
.code li.pending { color: var(--text); }
.hint-bad { margin-top: 10px; padding: 8px 10px; font-size: 12px; border: 1px solid var(--neon-red); color: var(--neon-red); }
.hint-bad code { color: var(--flash); user-select: text; -webkit-user-select: text; white-space: pre; }
.unlocked-banner {
  margin-bottom: 8px; padding: 6px 10px; text-align: center; letter-spacing: 0.3em; font-weight: 900; font-size: 12px;
  color: var(--void); background: var(--neon-green); box-shadow: var(--glow-green); animation: unlock 2.6s ease-out forwards;
}
@keyframes unlock { 0% { transform: scale(calc(1 + 0.5 * var(--fx-scale))); opacity: 0; } 12% { transform: scale(1); opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
.just-unlocked .code { animation: chunk-in 0.5s cubic-bezier(0.2, 1.4, 0.3, 1); }
@keyframes chunk-in { from { opacity: 0; transform: translateY(calc(14px * var(--fx-scale))); } to { opacity: 1; transform: none; } }
.finished { display: flex; flex-direction: column; gap: 4px; padding: 10px; border: 1px solid var(--neon-green); color: var(--neon-green); background: rgb(var(--neon-green-rgb) / 0.08); }
.finished span { color: var(--text); font-size: 12px; }
.run-box { margin-top: 10px; padding: 8px 10px; border: 1px solid rgb(var(--neon-cyan-rgb) / 0.3); user-select: text; -webkit-user-select: text; }
.run-box.error { border-color: var(--neon-red); color: var(--neon-red); font-size: 12px; }
.verdict { font-weight: 900; letter-spacing: 0.08em; }
.verdict.pass { color: var(--neon-green); text-shadow: var(--glow-green); }
.verdict.fail { color: var(--neon-red); }
.run-title { font-size: 10px; letter-spacing: 0.2em; color: var(--neon-cyan); }
.run-box pre { margin: 4px 0 0; white-space: pre-wrap; }
.err { color: var(--neon-red); }
.editor { min-width: 0; min-height: 0; }
.typing { position: relative; }
.race-clock { font-size: 10px; letter-spacing: 0.2em; color: var(--text-dim); white-space: nowrap; }
.race-clock b { font-family: var(--font-display); font-size: 15px; color: var(--neon-green); }
.race-clock.ghost b { color: var(--neon-violet); }
.ghost-track { position: relative; height: 16px; background: rgb(var(--void-rgb) / 0.7); border-bottom: 1px solid rgb(var(--neon-violet-rgb) / 0.4); }
.ghost-lines { position: absolute; inset: 0; transform-origin: left; background: linear-gradient(90deg, rgb(var(--neon-violet-rgb) / 0.15), rgb(var(--neon-violet-rgb) / 0.65)); transition: transform 0.12s linear; }
.ghost-track span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 10px; letter-spacing: 0.2em; color: var(--text); }
.race-result { position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: rgb(var(--void-rgb) / 0.9); }
.race-verdict { font-family: var(--font-display); font-size: 40px; font-weight: 900; letter-spacing: 0.12em; color: var(--text-dim); }
.race-verdict.win { color: var(--neon-amber); text-shadow: 0 0 calc(24px * var(--fx-scale)) var(--neon-amber), 0 0 calc(60px * var(--fx-scale)) var(--neon-red); }
.race-numbers { display: flex; gap: 24px; }
.race-numbers b { color: var(--neon-green); font-family: var(--font-display); }
.race-actions { display: flex; gap: 12px; }
</style>
