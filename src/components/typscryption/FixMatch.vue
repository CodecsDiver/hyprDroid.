<script setup lang="ts">
import { computed, ref } from 'vue'
import { emitJuice } from '../../juice/juiceBus'
import { contentForLevel, indentOf, type FixItem } from '../../typscryption/content'
import { botFixSeconds, seededRandom, shuffled } from '../../typscryption/engine'
import { formatSeconds, useRaceClock } from '../../typscryption/useRaceClock'
import LineTyper from './LineTyper.vue'
import MatchShell from './MatchShell.vue'
import RaceLanes from './RaceLanes.vue'
import ShimmerLine from './ShimmerLine.vue'

const props = defineProps<{ level: number; typingFactor: number; botName: string }>()
const emit = defineEmits<{ finished: [result: { won: boolean }]; exit: [] }>()

type Phase = 'intro' | 'countdown' | 'find' | 'type' | 'round-result' | 'match-result'
const ROUNDS = 3
const ROUNDS_TO_WIN = 2
const WRONG_LINE_PENALTY_MS = 3000
const HINT_PENALTY_MS = 2000

const random = seededRandom((Date.now() ^ (props.level * 104729)) >>> 0)
const clock = useRaceClock()

const items = ref<FixItem[]>([])
const roundIndex = ref(0)
const phase = ref<Phase>('intro')
const results = ref<boolean[]>([])
const wrongLines = ref<number[]>([])
const botSeconds = ref(10)
const yourSeconds = ref(0)
const hintShown = ref(false)
const hasReportedMatch = ref(false)

const item = computed(() => items.value[roundIndex.value])
const rounds = computed<Array<boolean | null>>(() => Array.from({ length: ROUNDS }, (_, index) => results.value[index] ?? null))
const botFraction = computed(() => (phase.value === 'find' || phase.value === 'type' ? clock.elapsedSeconds.value / botSeconds.value : phase.value === 'round-result' || phase.value === 'match-result' ? Math.min(1, yourSeconds.value / botSeconds.value) : 0))
const youFraction = computed(() => (phase.value === 'type' ? 0.55 : phase.value === 'round-result' || phase.value === 'match-result' ? 1 : phase.value === 'find' ? 0.1 : 0))
const botIsAhead = computed(() => (phase.value === 'find' || phase.value === 'type') && botFraction.value >= 1)
const matchWon = computed(() => results.value.filter(Boolean).length >= ROUNDS_TO_WIN)

function newMatch(): void {
  items.value = shuffled(contentForLevel(props.level).fix, random).slice(0, ROUNDS)
  roundIndex.value = 0
  results.value = []
  hasReportedMatch.value = false
  startRound()
}

function startRound(): void {
  const current = items.value[roundIndex.value]
  wrongLines.value = []
  hintShown.value = false
  botSeconds.value = botFixSeconds(props.level, current.lines.length, current.fixedLine.trim().length, props.typingFactor) * (0.92 + random() * 0.16)
  clock.reset()
  phase.value = 'countdown'
}

function onGo(): void {
  clock.start()
  phase.value = 'find'
}

function clickLine(index: number): void {
  if (phase.value !== 'find' || wrongLines.value.includes(index)) return
  if (index === item.value.brokenIndex) {
    phase.value = 'type'
    return
  }
  wrongLines.value = [...wrongLines.value, index]
  clock.addPenalty(WRONG_LINE_PENALTY_MS)
  emitJuice({ kind: 'objective-failed' })
}

function showHint(): void {
  if (hintShown.value) return
  hintShown.value = true
  clock.addPenalty(HINT_PENALTY_MS)
}

function fixed(): void {
  yourSeconds.value = clock.stop() / 1000
  const won = yourSeconds.value <= botSeconds.value
  results.value = [...results.value, won]
  phase.value = 'round-result'
  if (won) emitJuice({ kind: 'celebrate', scale: 1 })
}

function decided(): boolean {
  const wins = results.value.filter(Boolean).length
  return wins >= ROUNDS_TO_WIN || results.value.length - wins >= ROUNDS_TO_WIN
}

function nextRound(): void {
  if (roundIndex.value + 1 >= ROUNDS || decided()) {
    phase.value = 'match-result'
    if (!hasReportedMatch.value) {
      hasReportedMatch.value = true
      emit('finished', { won: matchWon.value })
    }
    return
  }
  roundIndex.value += 1
  startRound()
}
</script>

<template>
  <MatchShell
    title="FIX THIS BLOCK"
    :subtitle="`One line is broken. Click it, then retype it correctly before ${botName} does.`"
    :round-label="`Round ${Math.min(roundIndex + 1, ROUNDS)} of ${ROUNDS}`"
    :rounds="rounds"
    :countdown="phase === 'countdown'"
    @go="onGo"
    @exit="emit('exit')"
  >
    <template #clock>{{ phase === 'intro' ? '--' : formatSeconds(phase === 'round-result' || phase === 'match-result' ? yourSeconds : clock.elapsedSeconds.value) }}</template>
    <template #lanes>
      <RaceLanes :bot-label="botName" :you="youFraction" :bot="botFraction" :bot-time="phase === 'intro' ? '' : formatSeconds(botSeconds)" />
    </template>

    <div v-if="phase === 'intro'" class="intro">
      <p>Three rounds. Each block has one broken line. Click the broken line (a wrong click costs 3 seconds), then type the corrected line. A hint costs 2 seconds. Beat the bot in two rounds to win.</p>
      <button class="btn is-green is-hero" @click="newMatch()">Start</button>
    </div>

    <template v-else-if="item && phase !== 'match-result'">
      <div class="block">
        <div v-for="(line, index) in item.lines" :key="index" class="row">
          <template v-if="index === item.brokenIndex && phase === 'type'">
            <div class="typing-row"><span class="num">{{ index + 1 }}</span><LineTyper :target="item.fixedLine.trim()" :indent="indentOf(item.fixedLine)" :active="phase === 'type'" @done="fixed" @mistake="clock.addPenalty(500)" /></div>
          </template>
          <template v-else-if="index === item.brokenIndex && phase === 'round-result'">
            <ShimmerLine :text="item.fixedLine.trim()" :indent="indentOf(item.fixedLine)" :number="index + 1" />
          </template>
          <button
            v-else
            class="line"
            :class="{ wrong: wrongLines.includes(index), pickable: phase === 'find' }"
            :disabled="phase !== 'find' || wrongLines.includes(index)"
            @click="clickLine(index)"
          ><span class="num">{{ index + 1 }}</span><code>{{ line }}</code></button>
        </div>
      </div>

      <div v-if="phase === 'find'" class="help">
        <button class="btn is-ghost" :disabled="hintShown" @click="showHint()">{{ hintShown ? 'Hint shown' : 'Show a hint (+2s)' }}</button>
        <span v-if="hintShown" class="hint-text">{{ item.hint }}</span>
      </div>
      <p v-if="phase === 'type'" class="hint">Found it. Type the corrected line. Each wrong character adds half a second.</p>
      <p v-if="botIsAhead" class="bot-wins">{{ botName }} IS DONE. KEEP GOING TO FINISH, BUT THIS ROUND IS LOST.</p>

      <div v-if="phase === 'round-result'" class="round-result" :class="{ won: results[results.length - 1] }">
        <strong>{{ results[results.length - 1] ? 'ROUND WON' : 'ROUND LOST' }}</strong>
        <span>You {{ formatSeconds(yourSeconds) }} &middot; {{ botName }} {{ formatSeconds(botSeconds) }}<template v-if="wrongLines.length"> &middot; {{ wrongLines.length }} wrong click(s)</template></span>
        <span class="why">{{ item.hint }}</span>
      </div>
    </template>

    <div v-else-if="phase === 'match-result'" class="match-result" :class="{ won: matchWon }">
      <div class="verdict">{{ matchWon ? 'YOU WIN THE MATCH' : `${botName} WINS THE MATCH` }}</div>
      <p>{{ results.filter(Boolean).length }} of {{ results.length }} rounds won.</p>
    </div>

    <template #footer>
      <button v-if="phase === 'round-result'" class="btn is-green is-hero" @click="nextRound()">{{ roundIndex + 1 >= ROUNDS || decided() ? 'See result' : 'Next round' }}</button>
      <template v-if="phase === 'match-result'">
        <button class="btn is-ghost" @click="emit('exit')">Back to the hub</button>
        <button class="btn is-green" @click="newMatch()">Play again</button>
      </template>
    </template>
  </MatchShell>
</template>

<style scoped>
.intro { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; max-width: 640px; line-height: 1.6; }
.block { font-family: var(--font-editor); font-size: 17px; line-height: 1.7; }
.row { min-height: 29px; }
.num { display: inline-block; width: 28px; margin-right: 12px; text-align: right; color: var(--text-dim); font-size: 12px; }
.line { display: block; width: 100%; padding: 0 6px; text-align: left; background: none; border: 0; border-left: 3px solid transparent; color: var(--text); cursor: default; font: inherit; }
.line code { font: inherit; white-space: pre; }
.line.pickable { cursor: pointer; }
.line.pickable:hover { background: rgb(var(--neon-amber-rgb) / 0.12); border-left-color: var(--neon-amber); }
.line.wrong { background: rgb(var(--neon-red-rgb) / 0.2); border-left-color: var(--neon-red); animation: shake-line 0.3s; }
.typing-row { display: flex; align-items: baseline; }
.help { display: flex; align-items: center; gap: 14px; margin-top: 18px; }
.hint-text { color: var(--neon-amber); font-size: 13px; }
.hint { color: var(--text-dim); margin-top: 14px; }
.bot-wins { margin-top: 14px; color: var(--neon-red); letter-spacing: 0.12em; font-size: 12px; }
.round-result, .match-result { margin-top: 20px; display: flex; flex-direction: column; gap: 6px; padding: 14px 18px; border: 1px solid var(--neon-red); color: var(--neon-red); }
.round-result.won, .match-result.won { border-color: var(--neon-green); color: var(--neon-green); }
.round-result strong, .verdict { font-family: var(--font-display); letter-spacing: 0.14em; font-size: 22px; }
.round-result span { color: var(--text); font-size: 13px; }
.why { color: var(--text-dim) !important; }
.match-result { margin-top: 0; padding: 30px; align-items: center; text-align: center; }
.match-result.won .verdict { text-shadow: var(--glow-green); animation: win-pop 0.7s cubic-bezier(0.2, 1.5, 0.4, 1) both; }
@keyframes win-pop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes shake-line { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
:root[data-fx='off'] .match-result.won .verdict, :root[data-fx='off'] .line.wrong { animation: none; }
</style>
