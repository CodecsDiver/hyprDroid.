<script setup lang="ts">
import { computed, ref } from 'vue'
import { emitJuice } from '../../juice/juiceBus'
import { contentForLevel, indentOf, type SpeedItem } from '../../typscryption/content'
import { botLineSchedule, paceReport, seededRandom, shuffled, type PaceReport } from '../../typscryption/engine'
import { SPEEDCODER_LINE_SECONDS, levelName } from '../../typscryption/levels'
import { formatSeconds, useRaceClock } from '../../typscryption/useRaceClock'
import LineTyper from './LineTyper.vue'
import MatchShell from './MatchShell.vue'
import RaceLanes from './RaceLanes.vue'
import ShimmerLine from './ShimmerLine.vue'

const props = defineProps<{ level: number; typingFactor: number; botName: string }>()
const emit = defineEmits<{ finished: [result: { won: boolean; paceRatio: number }]; exit: [] }>()

type Phase = 'intro' | 'countdown' | 'racing' | 'result'
const MISTAKE_PENALTY_MS = 500

const random = seededRandom((Date.now() ^ (props.level * 1299709)) >>> 0)
const clock = useRaceClock()

const block = ref<SpeedItem | null>(null)
const phase = ref<Phase>('intro')
const lineIndex = ref(0)
const mistakes = ref(0)
const schedule = ref<number[]>([])
const yourSeconds = ref(0)
const pace = ref<PaceReport | null>(null)
const nextLevelPace = ref<PaceReport | null>(null)
const won = ref(false)

const lines = computed(() => block.value?.lines ?? [])
const botTotal = computed(() => schedule.value[schedule.value.length - 1] ?? 0)
const botLinesDone = computed(() => {
  const seconds = phase.value === 'result' ? yourSeconds.value : clock.elapsedSeconds.value
  return schedule.value.filter((finishedAt) => finishedAt <= seconds).length
})
const youFraction = computed(() => (lines.value.length ? lineIndex.value / lines.value.length : 0))
const botFraction = computed(() => (lines.value.length ? botLinesDone.value / lines.value.length : 0))
const botIsAhead = computed(() => phase.value === 'racing' && botLinesDone.value > lineIndex.value)
const levelAverage = computed(() => SPEEDCODER_LINE_SECONDS[Math.min(9, Math.max(1, props.level)) - 1])
const clockText = computed(() => (phase.value === 'intro' ? '--' : formatSeconds(phase.value === 'result' ? yourSeconds.value : clock.elapsedSeconds.value)))

function newRace(): void {
  const choices = shuffled(contentForLevel(props.level).speed, random)
  block.value = choices[0]
  schedule.value = botLineSchedule(props.level, block.value.lines, props.typingFactor, random)
  lineIndex.value = 0
  mistakes.value = 0
  pace.value = null
  nextLevelPace.value = null
  clock.reset()
  phase.value = 'countdown'
}

function onGo(): void {
  clock.start()
  phase.value = 'racing'
}

function lineDone(): void {
  if (lineIndex.value + 1 < lines.value.length) {
    lineIndex.value += 1
    return
  }
  lineIndex.value = lines.value.length
  yourSeconds.value = clock.stop() / 1000
  pace.value = paceReport(props.level, yourSeconds.value, lines.value)
  nextLevelPace.value = props.level < 9 ? paceReport(props.level + 1, yourSeconds.value, lines.value) : null
  won.value = yourSeconds.value <= botTotal.value
  phase.value = 'result'
  if (won.value) emitJuice({ kind: 'celebrate', scale: 1 })
  emit('finished', { won: won.value, paceRatio: pace.value.ratio })
}

function oneMistake(): void {
  mistakes.value += 1
  clock.addPenalty(MISTAKE_PENALTY_MS)
}
</script>

<template>
  <MatchShell
    title="SPEED CODER"
    :subtitle="`Type the whole block, line by line. Level ${level} average: ${levelAverage}s per line.`"
    :countdown="phase === 'countdown'"
    @go="onGo"
    @exit="emit('exit')"
  >
    <template #clock>{{ clockText }}</template>
    <template #lanes>
      <RaceLanes :bot-label="botName" :you="youFraction" :bot="botFraction" :you-time="`${lineIndex}/${lines.length}`" :bot-time="`${botLinesDone}/${lines.length}`" />
    </template>

    <div v-if="phase === 'intro'" class="intro">
      <p>One block of code, typed line by line (indentation is filled in for you). Every wrong character costs half a second. Finish before {{ botName }} to win, and your pace is checked against the average for {{ levelName(level) }}.</p>
      <button class="btn is-green is-hero" @click="newRace()">Start</button>
    </div>

    <template v-else-if="block">
      <div class="title-row">{{ block.title }}</div>
      <div class="columns">
        <div class="you-code">
          <div v-for="(line, index) in lines" :key="index" class="row">
            <ShimmerLine v-if="index < lineIndex" :text="line.trim()" :indent="indentOf(line)" :number="index + 1" />
            <div v-else-if="index === lineIndex && phase === 'racing'" class="typing-row"><span class="num">{{ index + 1 }}</span><LineTyper :target="line.trim()" :indent="indentOf(line)" :active="true" @done="lineDone" @mistake="oneMistake" /></div>
            <div v-else class="pending"><span class="num">{{ index + 1 }}</span><code>{{ line }}</code></div>
          </div>
        </div>
        <div class="bot-code">
          <div class="bot-title">{{ botName }}</div>
          <div v-for="(line, index) in lines" :key="index" class="row">
            <ShimmerLine v-if="index < botLinesDone" :text="line.trim()" :indent="indentOf(line)" tone="bot" />
            <div v-else class="pending ghosted"><code>{{ ' '.repeat(indentOf(line)) }}{{ '·'.repeat(Math.min(line.trim().length, 24)) }}</code></div>
          </div>
        </div>
      </div>
      <p v-if="botIsAhead" class="bot-wins">{{ botName }} IS AHEAD. KEEP GOING.</p>

      <div v-if="phase === 'result' && pace" class="result" :class="{ won }">
        <div class="verdict">{{ won ? 'YOU BEAT THE BOT' : `${botName} WINS` }}</div>
        <div class="stats">
          <span>Time <b>{{ formatSeconds(yourSeconds) }}</b></span>
          <span>{{ botName }} <b>{{ formatSeconds(botTotal) }}</b></span>
          <span>Mistakes <b>{{ mistakes }}</b></span>
        </div>
        <div class="pace">
          <strong>{{ pace.label }}</strong>
          <span>You averaged {{ pace.averageSecondsPerLine.toFixed(1) }}s per typical line. The average for {{ levelName(level) }} is {{ pace.libraryAverage }}s ({{ pace.ratio <= 1 ? Math.round((1 - pace.ratio) * 100) + '% faster' : Math.round((pace.ratio - 1) * 100) + '% slower' }}).</span>
          <span v-if="nextLevelPace && nextLevelPace.ratio <= 1" class="promo">This pace matches {{ levelName(level + 1) }}: win again and you move up.</span>
        </div>
      </div>
    </template>

    <template #footer>
      <template v-if="phase === 'result'">
        <button class="btn is-ghost" @click="emit('exit')">Back to the hub</button>
        <button class="btn is-green" @click="newRace()">Race again</button>
      </template>
    </template>
  </MatchShell>
</template>

<style scoped>
.intro { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; max-width: 640px; line-height: 1.6; }
.title-row { margin-bottom: 10px; font-size: 11px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--neon-amber); }
.columns { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 22px; }
.row { min-height: 29px; }
.num { display: inline-block; width: 28px; margin-right: 12px; text-align: right; color: var(--text-dim); font-size: 12px; }
.pending code { font-family: var(--font-editor); font-size: 16px; line-height: 1.65; white-space: pre; color: rgb(var(--text-dim-rgb) / 0.55); }
.ghosted code { color: rgb(var(--neon-violet-rgb) / 0.3); }
.typing-row { display: flex; align-items: baseline; }
.bot-code { border-left: 1px solid rgb(var(--neon-violet-rgb) / 0.35); padding-left: 18px; }
.bot-title { margin-bottom: 8px; font-size: 10px; letter-spacing: 0.28em; color: var(--neon-violet); }
.bot-wins { margin-top: 14px; color: var(--neon-red); letter-spacing: 0.12em; font-size: 12px; }
.result { margin-top: 22px; display: flex; flex-direction: column; gap: 10px; padding: 16px 20px; border: 1px solid var(--neon-red); }
.result.won { border-color: var(--neon-green); }
.verdict { font-family: var(--font-display); font-size: 26px; letter-spacing: 0.14em; color: var(--neon-red); }
.won .verdict { color: var(--neon-green); text-shadow: var(--glow-green); animation: win-pop 0.7s cubic-bezier(0.2, 1.5, 0.4, 1) both; }
.stats { display: flex; gap: 26px; }
.stats b { font-family: var(--font-display); color: var(--neon-cyan); }
.pace { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.pace strong { color: var(--neon-amber); letter-spacing: 0.14em; text-transform: uppercase; font-size: 12px; }
.promo { color: var(--neon-green); }
@keyframes win-pop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
:root[data-fx='off'] .won .verdict { animation: none; }
</style>
