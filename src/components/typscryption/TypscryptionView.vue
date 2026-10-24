<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useTypscryptionStore, type TypscryptionMode } from '../../stores/typscryptionStore'
import { useUiStore } from '../../stores/uiStore'
import { EXPERIENCE_QUESTION, TYPING_QUESTION, confidenceQuestion, type Confidence, type Experience, type IntakeAnswers, type TypingSpeed } from '../../typscryption/intake'
import { LEVEL_COUNT, SPEEDCODER_LINE_SECONDS, levelName } from '../../typscryption/levels'
import FixMatch from './FixMatch.vue'
import GuessMatch from './GuessMatch.vue'
import SpeedMatch from './SpeedMatch.vue'

const ui = useUiStore()
const store = useTypscryptionStore()

const activeMode = ref<TypscryptionMode | null>(null)
const step = ref(0)
const experience = ref<Experience | null>(null)
const confidence = ref<Confidence | null>(null)
const typing = ref<TypingSpeed | null>(null)

const questions = computed(() => {
  const first = EXPERIENCE_QUESTION
  const second = confidenceQuestion(experience.value ?? 'new')
  return [first, second, TYPING_QUESTION] as const
})
const currentQuestion = computed(() => questions.value[step.value])
const selected = computed(() => [experience.value, confidence.value, typing.value][step.value])
const winRate = computed(() => (store.matchesPlayed ? Math.round((store.matchesWon / store.matchesPlayed) * 100) : 0))

const MODES: ReadonlyArray<{ id: TypscryptionMode; title: string; blurb: string }> = [
  { id: 'guess', title: 'Guess the next line', blurb: 'A line is missing. Pick it from four choices, then type it. Three rounds against the bot.' },
  { id: 'fix', title: 'Fix this block', blurb: 'One line is broken. Find it, retype it correctly, and beat the bot to it. Three rounds.' },
  { id: 'speed', title: 'Speed Coder', blurb: 'Type a whole block line by line against a timer, with a pace check against your level\'s average.' },
]

function choose(value: string): void {
  if (step.value === 0) experience.value = value as Experience
  else if (step.value === 1) confidence.value = value as Confidence
  else typing.value = value as TypingSpeed
}

function next(): void {
  if (step.value < 2) {
    step.value += 1
    return
  }
  const answers: IntakeAnswers = { experience: experience.value!, confidence: confidence.value!, typing: typing.value! }
  store.completePlacement(answers)
  step.value = 0
}

function restartPlacement(): void {
  experience.value = confidence.value = typing.value = null
  step.value = 0
  store.retakePlacement()
}

function matchFinished(result: { won: boolean; paceRatio?: number }): void {
  store.recordMatch(result.won, result.paceRatio)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && ui.isTypscryptionOpen && !activeMode.value) ui.closeTypscryption()
}
onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  await store.load()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="ui.isTypscryptionOpen" class="scrim" role="dialog" aria-modal="true" aria-label="Typscryption">
    <div class="realm-backdrop" />
    <div class="shell panel">
      <div class="panel-title">
        <span>TYPSCRYPTION</span>
        <span class="tag">race the bot, one line at a time</span>
        <button class="close" title="Close (Esc)" @click="ui.closeTypscryption()">&#10005;</button>
      </div>

      <div class="content">
        <!-- Placement questions -->
        <section v-if="store.isLoaded && !store.hasPlacement" class="intake">
          <div class="dots"><i v-for="index in 3" :key="index" :class="{ on: index - 1 <= step }" /></div>
          <h2>{{ currentQuestion.prompt }}</h2>
          <p class="why">Question {{ step + 1 }} of 3. This sets which library of code the bot races you with, and how fast it types.</p>
          <div class="choices">
            <button
              v-for="option in currentQuestion.options"
              :key="option.value"
              class="choice"
              :class="{ picked: selected === option.value }"
              @click="choose(option.value)"
            >
              <strong>{{ option.label }}</strong>
              <span>{{ option.detail }}</span>
            </button>
          </div>
          <div class="nav">
            <button class="btn is-ghost" :disabled="step === 0" @click="step -= 1">Back</button>
            <button class="btn is-green is-hero" :disabled="!selected" @click="next()">{{ step === 2 ? 'Start racing' : 'Next' }}</button>
          </div>
        </section>

        <!-- The matches -->
        <GuessMatch v-else-if="activeMode === 'guess'" :level="store.level" :typing-factor="store.typingFactor" :bot-name="store.library.botName" @finished="matchFinished" @exit="activeMode = null" />
        <FixMatch v-else-if="activeMode === 'fix'" :level="store.level" :typing-factor="store.typingFactor" :bot-name="store.library.botName" @finished="matchFinished" @exit="activeMode = null" />
        <SpeedMatch v-else-if="activeMode === 'speed'" :level="store.level" :typing-factor="store.typingFactor" :bot-name="store.library.botName" @finished="matchFinished" @exit="activeMode = null" />

        <!-- Hub -->
        <section v-else-if="store.isLoaded" class="hub">
          <div class="status">
            <div class="badge"><span class="lvl-label">LEVEL</span><b>{{ store.level }}</b></div>
            <div class="who">
              <span class="level-name">{{ store.currentLevelName }}</span>
              <span class="library">{{ store.library.name }} &middot; races you with {{ store.library.botName }}</span>
              <span class="focus">Code in this library: {{ store.library.focus }}</span>
              <div class="ladder" :title="`Level ${store.level} of ${LEVEL_COUNT}`">
                <i v-for="level in LEVEL_COUNT" :key="level" :class="{ reached: level <= store.level, current: level === store.level }" :title="`${level}: ${levelName(level)} (${SPEEDCODER_LINE_SECONDS[level - 1]}s per line average)`" />
              </div>
            </div>
            <div class="record">
              <span>Matches <b>{{ store.matchesPlayed }}</b></span>
              <span>Won <b>{{ store.matchesWon }}</b> ({{ winRate }}%)</span>
              <span>Streak <b>{{ store.winStreak }}</b> win{{ store.winStreak === 1 ? '' : 's' }}</span>
              <span v-if="store.bestPaceRatio !== null">Best pace <b>{{ Math.round((1 - store.bestPaceRatio) * 100) }}%</b> {{ store.bestPaceRatio <= 1 ? 'faster' : 'slower' }}</span>
            </div>
          </div>

          <div class="modes">
            <button v-for="mode in MODES" :key="mode.id" class="mode" @click="activeMode = mode.id">
              <strong>{{ mode.title }}</strong>
              <span>{{ mode.blurb }}</span>
              <em>Race &#9654;</em>
            </button>
          </div>

          <p class="foot-note">Win two matches in a row and the bot moves you up a level; lose two and it eases you back, so every race stays close. The bot's times are estimates of an average learner at your level, tuned by your answers.</p>
          <div class="hub-actions"><button class="btn is-ghost" @click="restartPlacement()">Retake the placement questions</button></div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrim { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; background: rgb(var(--void-rgb) / 0.94); }
.shell { position: relative; z-index: 1; width: min(1180px, 96vw); height: min(780px, 94vh); display: flex; flex-direction: column; background: var(--hull-raised); }
.panel-title { display: flex; align-items: center; gap: 14px; letter-spacing: 0.3em; }
.tag { font-size: 10px; letter-spacing: 0.18em; color: var(--text-dim); text-transform: none; }
.close { margin-left: auto; background: none; border: 0; color: var(--text-dim); cursor: pointer; font-size: 14px; }
.close:hover { color: var(--neon-red); }
.content { flex: 1; min-height: 0; padding: 18px 22px 20px; overflow: auto; }

.intake { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.dots { display: flex; gap: 8px; }
.dots i { width: 28px; height: 4px; background: rgb(var(--text-dim-rgb) / 0.35); }
.dots i.on { background: var(--neon-cyan); box-shadow: var(--glow-cyan); }
h2 { margin: 6px 0 0; font-family: var(--font-display); font-size: 28px; letter-spacing: 0.08em; color: var(--neon-cyan); }
.why { margin: 0; color: var(--text-dim); font-size: 12px; line-height: 1.6; }
.choices { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
.choice { display: flex; flex-direction: column; gap: 3px; padding: 14px 18px; text-align: left; cursor: pointer; background: rgb(var(--neon-cyan-rgb) / 0.05); border: 1px solid rgb(var(--neon-cyan-rgb) / 0.3); color: var(--text); }
.choice span { font-size: 12px; color: var(--text-dim); }
.choice:hover { border-color: var(--neon-cyan); }
.choice.picked { border-color: var(--neon-green); background: rgb(var(--neon-green-rgb) / 0.1); box-shadow: var(--glow-green); }
.nav { display: flex; justify-content: space-between; margin-top: 12px; }

.hub { display: flex; flex-direction: column; gap: 22px; }
.status { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 22px; padding: 16px 20px; border: 1px solid var(--glass-edge); background: rgb(var(--neon-cyan-rgb) / 0.04); }
.badge { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 92px; height: 92px; clip-path: polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%); background: linear-gradient(160deg, var(--neon-violet), var(--neon-cyan)); color: var(--void); }
.lvl-label { font-size: 9px; letter-spacing: 0.3em; }
.badge b { font-family: var(--font-display); font-size: 38px; line-height: 1; }
.who { display: flex; flex-direction: column; gap: 3px; }
.level-name { font-family: var(--font-display); font-size: 24px; letter-spacing: 0.1em; color: var(--neon-cyan); }
.library { font-size: 12px; color: var(--neon-violet); letter-spacing: 0.08em; }
.focus { font-size: 12px; color: var(--text-dim); }
.ladder { display: flex; gap: 5px; margin-top: 8px; }
.ladder i { width: 26px; height: 6px; background: rgb(var(--text-dim-rgb) / 0.3); }
.ladder i.reached { background: var(--neon-cyan); }
.ladder i.current { background: var(--neon-green); box-shadow: var(--glow-green); }
.record { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--text-dim); text-align: right; }
.record b { color: var(--neon-green); font-family: var(--font-display); }

.modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.mode { display: flex; flex-direction: column; gap: 10px; padding: 22px 20px; text-align: left; cursor: pointer; background: rgb(var(--neon-violet-rgb) / 0.07); border: 1px solid rgb(var(--neon-violet-rgb) / 0.5); color: var(--text); min-height: 190px; transition: transform 0.15s, box-shadow 0.15s; }
.mode:hover { transform: translateY(-3px); box-shadow: var(--glow-violet); border-color: var(--neon-violet); }
.mode strong { font-family: var(--font-display); font-size: 18px; letter-spacing: 0.1em; color: var(--neon-violet); }
.mode span { font-size: 13px; line-height: 1.6; color: var(--text); flex: 1; }
.mode em { font-style: normal; font-size: 11px; letter-spacing: 0.24em; color: var(--neon-green); text-transform: uppercase; }
.foot-note { margin: 0; font-size: 12px; line-height: 1.7; color: var(--text-dim); max-width: 820px; }
.hub-actions { display: flex; }
@media (max-width: 900px) { .modes { grid-template-columns: 1fr; } .status { grid-template-columns: 1fr; } .record { text-align: left; } }
</style>
