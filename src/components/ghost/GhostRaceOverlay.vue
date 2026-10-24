<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { findProject } from '../../curriculum/projects'
import type { ObjectiveResult } from '../../curriculum/types'
import { formatDelta, formatMs, ghostTextAt, RunRecorder, type GhostVerdict } from '../../ghost/ghostRecord'
import { emitJuice } from '../../juice/juiceBus'
import { usePracticeStore } from '../../stores/practiceStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUiStore } from '../../stores/uiStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import CodeEditor from '../editor/CodeEditor.vue'
import CountdownBanner from '../shell/CountdownBanner.vue'

type Phase = 'ready' | 'countdown' | 'racing' | 'done'

const ui = useUiStore()
const practice = usePracticeStore()
const settings = useSettingsStore()
const workspace = useWorkspaceStore()

const mission = computed(() => (ui.raceMissionId ? findProject(ui.raceMissionId) : undefined))
const ghostKey = computed(() => `mission:${ui.raceMissionId}`)
const ghost = computed(() => (ui.raceMissionId ? practice.ghostFor(ghostKey.value) : undefined))

const phase = ref<Phase>('ready')
const code = ref('')
const results = ref<Record<string, ObjectiveResult>>({})
const message = ref('')
const isChecking = ref(false)
const now = ref(Date.now())
const finalMs = ref(0)
const verdict = ref<GhostVerdict | null>(null)
/** The ghost's time when this run began, kept because a faster run replaces the stored ghost. */
const ghostBeforeRun = ref<number | null>(null)
/** The ghost being raced during this run, kept for the same reason. */
const racedGhost = ref(ghost.value)

let recorder: RunRecorder | null = null
let ticker: ReturnType<typeof setInterval> | undefined

/** Active milliseconds of this run. `now` is read so the clock re-renders on every tick. */
const yourMs = computed(() => {
  if (phase.value === 'done') return finalMs.value
  return now.value >= 0 ? (recorder?.elapsed(now.value) ?? 0) : 0
})
const ghostText = computed(() => (racedGhost.value ? ghostTextAt(racedGhost.value, yourMs.value) : ''))
const ghostFraction = computed(() => (racedGhost.value ? Math.min(1, yourMs.value / racedGhost.value.ms) : 0))
const isAhead = computed(() => racedGhost.value !== null && yourMs.value > 0 && ghostText.value.length <= code.value.length)

function reset(): void {
  phase.value = 'ready'
  code.value = ''
  results.value = {}
  message.value = ''
  verdict.value = null
  recorder = null
  clearInterval(ticker)
}

watch(() => ui.raceMissionId, (id) => id && reset(), { immediate: true })
onBeforeUnmount(() => clearInterval(ticker))

function begin(): void {
  if (!mission.value) return
  reset()
  code.value = mission.value.starterCode
  racedGhost.value = ghost.value
  ghostBeforeRun.value = ghost.value?.ms ?? null
  phase.value = 'countdown'
}

function go(): void {
  if (!mission.value) return
  recorder = new RunRecorder(mission.value.starterCode)
  phase.value = 'racing'
  now.value = Date.now()
  clearInterval(ticker)
  ticker = setInterval(() => (now.value = Date.now()), 100)
}

function onTyped(text: string): void {
  if (phase.value !== 'racing') return
  code.value = text
  recorder?.change(text, Date.now())
}

async function check(): Promise<void> {
  if (phase.value !== 'racing' || !mission.value || isChecking.value) return
  isChecking.value = true
  message.value = ''
  try {
    const checked = await workspace.checkPracticeCopy(mission.value.id, code.value)
    if (!checked.results) {
      message.value = checked.detail
      return
    }
    results.value = checked.results
    const passed = mission.value.objectives.every((objective) => checked.results![objective.id].status === 'pass')
    if (!passed) {
      emitJuice({ kind: 'objective-failed' })
      return
    }
    finish()
  } finally {
    isChecking.value = false
  }
}

function finish(): void {
  const record = recorder?.finish(ghostKey.value, Date.now())
  clearInterval(ticker)
  if (!record) {
    message.value = 'Type your solution first: a run only counts when you wrote it.'
    return
  }
  finalMs.value = record.ms
  verdict.value = practice.submitRun(record)
  phase.value = 'done'
  const beatGhost = ghostBeforeRun.value === null || record.ms < ghostBeforeRun.value
  emitJuice({
    kind: 'banner',
    tone: beatGhost ? 'amber' : 'cyan',
    headline: verdict.value === 'first' ? 'GHOST CREATED' : beatGhost ? 'YOU BEAT THE GHOST' : 'THE GHOST WINS',
    detail: `${mission.value?.title}: ${formatMs(record.ms)}`,
  })
  if (beatGhost) emitJuice({ kind: 'celebrate', scale: 2 })
}

function leave(): void {
  clearInterval(ticker)
  ui.endRace()
}

const statusOf = (id: string) => results.value[id]?.status
</script>

<template>
  <div v-if="ui.raceMissionId && mission" class="race-scrim" role="dialog" aria-modal="true" aria-label="Ghostcode race">
    <div class="race panel">
      <div class="panel-title">
        <span>GHOSTCODE &middot; {{ mission.title }}</span>
        <span class="no-xp">practice run &middot; no XP</span>
        <button class="close" title="Leave the race" @click="leave()">&#10005;</button>
      </div>

      <div class="clocks">
        <div class="clock you"><span class="label">YOU</span><span class="time">{{ formatMs(yourMs) }}</span></div>
        <div class="bar" :title="racedGhost ? 'Your time as a share of the ghost\'s time' : 'No ghost yet'">
          <i class="ghost-fill" :style="{ width: `${ghostFraction * 100}%` }" />
          <b v-if="phase === 'racing' && racedGhost && yourMs > 0" class="gap" :class="{ ahead: isAhead }">{{ isAhead ? 'AHEAD OF THE GHOST' : 'GHOST IS AHEAD' }}</b>
        </div>
        <div class="clock ghostc"><span class="label">GHOST</span><span class="time">{{ racedGhost ? formatMs(racedGhost.ms) : '--:--.-' }}</span></div>
      </div>

      <div v-if="phase === 'ready'" class="ready">
        <p v-if="ghost">Your best run on this mission is <b>{{ formatMs(ghost.ms) }}</b>. A ghost of it types beside you. The clock starts on your first keystroke, so you can read first.</p>
        <p v-else>You have no ghost on this mission yet. Your first run here becomes the ghost.</p>
        <p class="dim">You start from the starter code and type every line. Pasting is blocked. A run replaces the ghost only if it is faster.</p>
        <button class="btn is-green is-hero" @click="begin()">Start the race</button>
      </div>

      <div v-else class="stage">
        <aside class="objectives">
          <div v-for="objective in mission.objectives" :key="objective.id" class="objective" :class="statusOf(objective.id)">
            <span class="tick">{{ statusOf(objective.id) === 'pass' ? '✓' : statusOf(objective.id) ? '✗' : '○' }}</span>
            <div>
              <div class="o-title">{{ objective.title }}</div>
              <div class="o-hint">{{ objective.hint }}</div>
              <div v-if="results[objective.id] && results[objective.id].status !== 'pass'" class="o-error">{{ results[objective.id].message }}</div>
            </div>
          </div>
        </aside>
        <section class="pane">
          <div class="pane-title">YOUR CODE</div>
          <div class="editor-slot">
            <CodeEditor :model-value="code" :read-only="phase !== 'racing'" plain-typing :effects="phase === 'racing'" :font-size="Math.min(settings.editorFontSize, 16)" @update:model-value="onTyped" />
          </div>
        </section>
        <section class="pane ghost-pane">
          <div class="pane-title">GHOST</div>
          <div class="editor-slot ghost-editor">
            <CodeEditor v-if="racedGhost" :model-value="ghostText" read-only :effects="false" :font-size="Math.min(settings.editorFontSize, 16)" />
            <div v-else class="no-ghost">No ghost yet.<br />This run will make one.</div>
          </div>
        </section>
      </div>

      <div v-if="message" class="message">{{ message }}</div>

      <div v-if="phase === 'racing'" class="footer">
        <button class="btn is-ghost" @click="leave()">Give up</button>
        <button class="btn is-violet is-hero" :disabled="isChecking" @click="check()">{{ isChecking ? 'Checking...' : 'Check my work' }}</button>
      </div>

      <div v-if="phase === 'done'" class="result">
        <div class="verdict" :class="{ win: verdict !== 'slower' }">
          <template v-if="verdict === 'first'">GHOST CREATED</template>
          <template v-else-if="verdict === 'faster'">NEW RECORD</template>
          <template v-else>THE GHOST HOLDS</template>
        </div>
        <div class="numbers">
          <span>Your time <b>{{ formatMs(finalMs) }}</b></span>
          <span v-if="ghostBeforeRun !== null">Ghost was <b>{{ formatMs(ghostBeforeRun) }}</b> ({{ formatDelta(finalMs - ghostBeforeRun) }})</span>
        </div>
        <p class="dim">{{ verdict === 'slower' ? 'The faster run stays as the ghost. Go again to beat it.' : 'This run is the ghost now. Beat it next time.' }}</p>
        <div class="actions">
          <button class="btn is-ghost" @click="leave()">Done</button>
          <button class="btn is-green" @click="begin()">Race again</button>
        </div>
      </div>

      <CountdownBanner :active="phase === 'countdown'" @go="go" />
    </div>
  </div>
</template>

<style scoped>
.race-scrim { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; background: rgb(var(--void-rgb) / 0.82); }
.race { position: relative; width: min(1320px, 96vw); height: min(780px, 92vh); display: flex; flex-direction: column; background: var(--hull-raised); overflow: hidden; }
.panel-title { display: flex; align-items: center; gap: 14px; }
.no-xp { margin-left: auto; font-size: 10px; letter-spacing: 0.18em; color: var(--text-dim); }
.close { background: none; border: 0; color: var(--text-dim); cursor: pointer; font-size: 14px; }
.close:hover { color: var(--neon-red); }
.clocks { display: grid; grid-template-columns: 170px 1fr 170px; align-items: center; gap: 16px; padding: 12px 18px; }
.clock { display: flex; flex-direction: column; }
.clock.ghostc { text-align: right; }
.label { font-size: 9px; letter-spacing: 0.3em; color: var(--text-dim); }
.time { font-family: var(--font-display); font-size: 28px; font-weight: 800; }
.you .time { color: var(--neon-green); text-shadow: var(--glow-green); }
.ghostc .time { color: var(--neon-violet); text-shadow: var(--glow-violet); }
.bar { position: relative; height: 12px; background: rgb(var(--void-rgb) / 0.8); border: 1px solid rgb(var(--neon-violet-rgb) / 0.4); }
.ghost-fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, rgb(var(--neon-violet-rgb) / 0.2), var(--neon-violet)); transition: width 0.1s linear; }
.gap { position: absolute; right: 8px; top: -18px; font-size: 10px; letter-spacing: 0.2em; color: var(--neon-red); }
.gap.ahead { color: var(--neon-green); }
.ready { padding: 20px 28px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; line-height: 1.6; max-width: 720px; }
.dim { color: var(--text-dim); font-size: 12px; }
.stage { flex: 1; min-height: 0; display: grid; grid-template-columns: 280px minmax(0, 1fr) minmax(0, 1fr); gap: 10px; padding: 0 12px 12px; }
.objectives { overflow: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 4px; }
.objective { display: flex; gap: 8px; padding: 8px 10px; border: 1px solid rgb(var(--neon-cyan-rgb) / 0.25); font-size: 12px; line-height: 1.45; }
.objective.pass { border-color: var(--neon-green); }
.objective.fail, .objective.error { border-color: var(--neon-red); }
.tick { color: var(--neon-cyan); }
.pass .tick { color: var(--neon-green); }
.fail .tick, .error .tick { color: var(--neon-red); }
.o-title { font-weight: 700; }
.o-hint { color: var(--text-dim); font-size: 11px; margin-top: 3px; }
.o-error { color: var(--neon-red); font-size: 11px; margin-top: 4px; white-space: pre-wrap; user-select: text; -webkit-user-select: text; }
.pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; border: 1px solid var(--glass-edge); background: rgb(var(--editor-bg-rgb) / 0.9); }
.ghost-pane { border-color: rgb(var(--neon-violet-rgb) / 0.5); opacity: 0.9; }
.pane-title { padding: 5px 10px; font-size: 10px; letter-spacing: 0.25em; color: var(--text-dim); border-bottom: 1px solid rgb(var(--neon-cyan-rgb) / 0.2); }
.editor-slot { flex: 1; min-height: 0; position: relative; }
.ghost-editor :deep(.monaco-editor) { filter: hue-rotate(35deg) saturate(0.85); }
.no-ghost { display: grid; place-items: center; height: 100%; text-align: center; color: var(--text-dim); line-height: 1.7; }
.message { margin: 0 14px 6px; color: var(--neon-red); font-size: 12px; white-space: pre-wrap; max-height: 80px; overflow: auto; user-select: text; -webkit-user-select: text; }
.footer { display: flex; justify-content: flex-end; gap: 12px; padding: 8px 14px 14px; }
.result { position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: rgb(var(--void-rgb) / 0.9); text-align: center; }
.verdict { font-family: var(--font-display); font-size: 52px; font-weight: 900; letter-spacing: 0.12em; color: var(--text-dim); }
.verdict.win { color: var(--neon-amber); text-shadow: 0 0 calc(30px * var(--fx-scale)) var(--neon-amber), 0 0 calc(70px * var(--fx-scale)) var(--neon-red); animation: verdict-pop 0.8s cubic-bezier(0.2, 1.5, 0.4, 1) both; }
.numbers { display: flex; gap: 28px; font-size: 16px; }
.numbers b { color: var(--neon-green); font-family: var(--font-display); }
.actions { display: flex; gap: 14px; margin-top: 8px; }
@keyframes verdict-pop { 0% { transform: scale(0.3); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
:root[data-fx='off'] .verdict.win { animation: none; }
</style>
