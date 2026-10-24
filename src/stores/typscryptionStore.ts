import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { loadDocument, saveDocument } from '../backend/backend'
import { emitJuice } from '../juice/juiceBus'
import { adaptLevel } from '../typscryption/engine'
import { placeLearner, type IntakeAnswers } from '../typscryption/intake'
import { LEVEL_COUNT, levelName, libraryOfLevel } from '../typscryption/levels'

export type TypscryptionMode = 'guess' | 'fix' | 'speed'

interface TypscryptionDocument {
  schemaVersion: 1
  intake: IntakeAnswers | null
  level: number
  typingFactor: number
  winStreak: number
  lossStreak: number
  matchesPlayed: number
  matchesWon: number
  /** Lowest pace ratio ever recorded in Speed Coder (lower is faster than the library average). */
  bestPaceRatio: number | null
}

const EXPERIENCES = ['new', 'some', 'lots']
const CONFIDENCES = ['low', 'mid', 'high']
const TYPINGS = ['slow', 'steady', 'fast']

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 1_000_000

function sanitizeIntake(value: unknown): IntakeAnswers | null {
  const source = value as Partial<IntakeAnswers> | null
  if (!source || !EXPERIENCES.includes(source.experience as string) || !CONFIDENCES.includes(source.confidence as string) || !TYPINGS.includes(source.typing as string)) return null
  return { experience: source.experience!, confidence: source.confidence!, typing: source.typing! }
}

export const useTypscryptionStore = defineStore('typscryption', () => {
  const intake = ref<IntakeAnswers | null>(null)
  const level = ref(1)
  const typingFactor = ref(1)
  const winStreak = ref(0)
  const lossStreak = ref(0)
  const matchesPlayed = ref(0)
  const matchesWon = ref(0)
  const bestPaceRatio = ref<number | null>(null)
  const isLoaded = ref(false)

  const library = computed(() => libraryOfLevel(level.value))
  const currentLevelName = computed(() => levelName(level.value))
  const hasPlacement = computed(() => intake.value !== null)

  async function load(): Promise<void> {
    if (isLoaded.value) return
    try {
      const stored = await loadDocument<Partial<TypscryptionDocument>>('typscryption')
      const answers = sanitizeIntake(stored?.intake)
      if (stored && answers) {
        intake.value = answers
        const placement = placeLearner(answers)
        level.value = typeof stored.level === 'number' && stored.level >= 1 && stored.level <= LEVEL_COUNT ? Math.round(stored.level) : placement.level
        typingFactor.value = placement.typingFactor
        winStreak.value = isCount(stored.winStreak) ? stored.winStreak : 0
        lossStreak.value = isCount(stored.lossStreak) ? stored.lossStreak : 0
        matchesPlayed.value = isCount(stored.matchesPlayed) ? stored.matchesPlayed : 0
        matchesWon.value = isCount(stored.matchesWon) ? Math.min(stored.matchesWon, matchesPlayed.value) : 0
        bestPaceRatio.value = typeof stored.bestPaceRatio === 'number' && stored.bestPaceRatio > 0 ? stored.bestPaceRatio : null
      }
    } catch (error) {
      console.warn('typscryption data could not be loaded, starting fresh', error)
    }
    isLoaded.value = true
  }

  watch([intake, level, typingFactor, winStreak, lossStreak, matchesPlayed, matchesWon, bestPaceRatio], () => {
    if (!isLoaded.value) return
    const document_: TypscryptionDocument = {
      schemaVersion: 1,
      intake: intake.value ? { ...intake.value } : null,
      level: level.value,
      typingFactor: typingFactor.value,
      winStreak: winStreak.value,
      lossStreak: lossStreak.value,
      matchesPlayed: matchesPlayed.value,
      matchesWon: matchesWon.value,
      bestPaceRatio: bestPaceRatio.value,
    }
    saveDocument('typscryption', document_).catch((error) => console.warn('typscryption data could not be saved', error))
  }, { deep: true })

  /** Stores the placement answers and starts you at the level they imply. */
  function completePlacement(answers: IntakeAnswers): void {
    const placement = placeLearner(answers)
    intake.value = { ...answers }
    level.value = placement.level
    typingFactor.value = placement.typingFactor
    winStreak.value = 0
    lossStreak.value = 0
  }

  function retakePlacement(): void {
    intake.value = null
  }

  /** Records a finished match, moves your level if the streak says so, and announces it. */
  function recordMatch(won: boolean, paceRatio?: number): { change: -1 | 0 | 1; level: number } {
    matchesPlayed.value += 1
    if (won) matchesWon.value += 1
    if (paceRatio !== undefined && (bestPaceRatio.value === null || paceRatio < bestPaceRatio.value)) bestPaceRatio.value = paceRatio
    const adapted = adaptLevel(level.value, winStreak.value, lossStreak.value, won)
    winStreak.value = adapted.winStreak
    lossStreak.value = adapted.lossStreak
    if (adapted.change !== 0) {
      level.value = adapted.level
      emitJuice({
        kind: 'banner',
        tone: adapted.change > 0 ? 'amber' : 'cyan',
        headline: adapted.change > 0 ? 'LEVEL UP' : 'LEVEL ADJUSTED',
        detail: `${levelName(adapted.level)} (level ${adapted.level} of ${LEVEL_COUNT}, ${libraryOfLevel(adapted.level).name})`,
      })
      if (adapted.change > 0) emitJuice({ kind: 'celebrate', scale: 3 })
    } else if (won) {
      emitJuice({ kind: 'celebrate', scale: 2 })
    }
    return { change: adapted.change, level: adapted.level }
  }

  return {
    intake, level, typingFactor, winStreak, lossStreak, matchesPlayed, matchesWon, bestPaceRatio, isLoaded,
    library, currentLevelName, hasPlacement,
    load, completePlacement, retakePlacement, recordMatch,
  }
})
