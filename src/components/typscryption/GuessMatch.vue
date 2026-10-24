<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { emitJuice } from '../../juice/juiceBus'
import { contentForLevel, indentOf, type GuessItem } from '../../typscryption/content'
import { botGuessSeconds, seededRandom, shuffled } from '../../typscryption/engine'
import { formatSeconds, useRaceClock } from '../../typscryption/useRaceClock'
import LineTyper from './LineTyper.vue'
import MatchShell from './MatchShell.vue'
import RaceLanes from './RaceLanes.vue'
import ShimmerLine from './ShimmerLine.vue'

const props = defineProps<{ level: number; typingFactor: number; botName: string }>()
const emit = defineEmits<{ finished: [result: { won: boolean }]; exit: [] }>()

type Phase = 'intro' | 'countdown' | 'choose' | 'type' | 'round-result' | 'match-result'
const ROUNDS = 3
const WRONG_PICK_PENALTY_MS = 3000
const ROUNDS_TO_WIN = 2

const random = seededRandom((Date.now() ^ (props.level * 7919)) >>> 0)
const clock = useRaceClock()

const items = ref<GuessItem[]>([])
const roundIndex = ref(0)
const phase = ref<Phase>('intro')
const results = ref<boolean[]>([])
const options = ref<string[]>([])
const wrongPicks = ref<string[]>([])
const botSeconds = ref(10)
const yourSeconds = ref(0)
const mistakes = ref(0)
const hasReportedMatch = ref(false)

const item = computed(() => items.value[roundIndex.value])
const answer = computed(() => item.value?.lines[item.value.hiddenIndex] ?? '')
const rounds = computed<Array<boolean | null>>(() => Array.from({ length: ROUNDS }, (_, index) => results.value[index] ?? null))
const botFraction = computed(() => (phase.value === 'choose' || phase.value === 'type' ? clock.elapsedSeconds.value / botSeconds.value : phase.value === 'round-result' || phase.value === 'match-result' ? Math.min(1, yourSeconds.value / botSeconds.value) : 0))
const youFraction = computed(() => (phase.value === 'type' ? 0.55 : phase.value === 'round-result' || phase.value === 'match-result' ? 1 : phase.value === 'choose' ? 0.1 : 0))
const botIsAhead = computed(() => (phase.value === 'choose' || phase.value === 'type') && botFraction.value >= 1)
const matchWon = computed(() => results.value.filter(Boolean).length >= ROUNDS_TO_WIN)

function newMatch(): void {
  items.value = shuffled(contentForLevel(props.level).guess, random).slice(0, ROUNDS)
  roundIndex.value = 0
  results.value = []
  hasReportedMatch.value = false
  startRound()
}

function startRound(): void {
  const current = items.value[roundIndex.value]
  const right = current.lines[current.hiddenIndex].trim()
  options.value = shuffled([right, ...current.distractors.map((line) => line.trim())], random)
  wrongPicks.value = []
  mistakes.value = 0
  botSeconds.value = botGuessSeconds(props.level, current.lines.length, right.length, props.typingFactor) * (0.92 + random() * 0.16)
  clock.reset()
  phase.value = 'countdown'
}

function onGo(): void {
  clock.start()
  phase.value = 'choose'
}

function pick(option: string): void {
  if (phase.value !== 'choose' || wrongPicks.value.includes(option)) return
  if (option === answer.value.trim()) {
    phase.value = 'type'
    return
  }
  wrongPicks.value = [...wrongPicks.value, option]
  clock.addPenalty(WRONG_PICK_PENALTY_MS)
  emitJuice({ kind: 'objective-failed' })
}

function typed(): void {
  yourSeconds.value = clock.stop() / 1000
  const won = yourSeconds.value <= botSeconds.value
  results.value = [...results.value, won]
  phase.value = 'round-result'
  if (won) emitJuice({ kind: 'celebrate', scale: 1 })
}

function nextRound(): void {
  if (roundIndex.value + 1 >= ROUNDS || winsOrLossesDecided()) {
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

/** Best of three ends as soon as someone has two round wins. */
function winsOrLossesDecided(): boolean {
  const wins = results.value.filter(Boolean).length
  return wins >= ROUNDS_TO_WIN || results.value.length - wins >= ROUNDS_TO_WIN
}

function onKeydown(event: KeyboardEvent): void {
  if (phase.value !== 'choose') return
  const index = Number(event.key) - 1
  if (index >= 0 && index < options.value.length) pick(options.value[index])
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <MatchShell
    title="GUESS THE NEXT LINE"
    :subtitle="`Pick the missing line, then type it. First to finish beats ${botName}.`"
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
      <p>Three rounds. In each one a line of code is missing. Pick the right line from four choices (a wrong pick costs 3 seconds), then type it in. Beat the bot's time in two rounds to win the match.</p>
      <button class="btn is-green is-hero" @click="newMatch()">Start</button>
    </div>

    <template v-else-if="item && phase !== 'match-result'">
      <div class="block">
        <div v-for="(line, index) in item.lines" :key="index" class="row">
          <template v-if="index === item.hiddenIndex">
            <ShimmerLine v-if="phase === 'round-result'" :text="line.trim()" :indent="indentOf(line)" :number="index + 1" />
            <div v-else-if="phase === 'type'" class="typing-row"><span class="num">{{ index + 1 }}</span><LineTyper :target="line.trim()" :indent="indentOf(line)" :active="phase === 'type'" @done="typed" @mistake="clock.addPenalty(500); mistakes++" /></div>
            <div v-else class="missing"><span class="num">{{ index + 1 }}</span><code>{{ ' '.repeat(indentOf(line)) }}???</code></div>
          </template>
          <div v-else class="plain"><span class="num">{{ index + 1 }}</span><code>{{ line }}</code></div>
        </div>
      </div>

      <div v-if="phase === 'choose'" class="options">
        <button v-for="(option, index) in options" :key="option" class="option" :class="{ wrong: wrongPicks.includes(option) }" :disabled="wrongPicks.includes(option)" @click="pick(option)">
          <kbd>{{ index + 1 }}</kbd><code>{{ option }}</code>
        </button>
      </div>
      <p v-if="phase === 'type'" class="hint">Right! Now type it. Each wrong character adds half a second.</p>
      <p v-if="botIsAhead" class="bot-wins">{{ botName }} IS DONE. KEEP GOING TO FINISH, BUT THIS ROUND IS LOST.</p>

      <div v-if="phase === 'round-result'" class="round-result" :class="{ won: results[results.length - 1] }">
        <strong>{{ results[results.length - 1] ? 'ROUND WON' : 'ROUND LOST' }}</strong>
        <span>You {{ formatSeconds(yourSeconds) }} &middot; {{ botName }} {{ formatSeconds(botSeconds) }}<template v-if="wrongPicks.length"> &middot; {{ wrongPicks.length }} wrong pick(s)</template></span>
      </div>
    </template>

    <div v-else-if="phase === 'match-result'" class="match-result" :class="{ won: matchWon }">
      <div class="verdict">{{ matchWon ? 'YOU WIN THE MATCH' : `${botName} WINS THE MATCH` }}</div>
      <p>{{ results.filter(Boolean).length }} of {{ results.length }} rounds won.</p>
    </div>

    <template #footer>
      <button v-if="phase === 'round-result'" class="btn is-green is-hero" @click="nextRound()">{{ roundIndex + 1 >= ROUNDS || winsOrLossesDecided() ? 'See result' : 'Next round' }}</button>
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
.plain code, .missing code { white-space: pre; font: inherit; color: var(--text); }
.missing code { color: var(--neon-amber); background: rgb(var(--neon-amber-rgb) / 0.12); padding: 0 6px; }
.typing-row { display: flex; align-items: baseline; }
.options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 20px; }
.option { display: flex; align-items: center; gap: 12px; padding: 12px 14px; text-align: left; cursor: pointer; background: rgb(var(--neon-cyan-rgb) / 0.06); border: 1px solid rgb(var(--neon-cyan-rgb) / 0.4); color: var(--text); }
.option:hover:not(:disabled) { border-color: var(--neon-cyan); box-shadow: var(--glow-cyan); }
.option kbd { padding: 1px 7px; font-size: 11px; border: 1px solid var(--text-dim); color: var(--text-dim); }
.option code { font-family: var(--font-editor); font-size: 15px; white-space: pre-wrap; }
.option.wrong { opacity: 0.45; border-color: var(--neon-red); text-decoration: line-through; cursor: not-allowed; }
.hint { color: var(--text-dim); margin-top: 14px; }
.bot-wins { margin-top: 14px; color: var(--neon-red); letter-spacing: 0.12em; font-size: 12px; }
.round-result, .match-result { margin-top: 20px; display: flex; flex-direction: column; gap: 6px; padding: 14px 18px; border: 1px solid var(--neon-red); color: var(--neon-red); }
.round-result.won, .match-result.won { border-color: var(--neon-green); color: var(--neon-green); }
.round-result strong, .verdict { font-family: var(--font-display); letter-spacing: 0.14em; font-size: 22px; }
.round-result span { color: var(--text); font-size: 13px; }
.match-result { margin-top: 0; padding: 30px; align-items: center; text-align: center; }
.match-result.won .verdict { text-shadow: var(--glow-green); animation: win-pop 0.7s cubic-bezier(0.2, 1.5, 0.4, 1) both; }
@keyframes win-pop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
:root[data-fx='off'] .match-result.won .verdict { animation: none; }
</style>
