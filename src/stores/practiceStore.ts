import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { loadDocument, openSolutionWindow, saveDocument } from '../backend/backend'
import { recordFailedCheck, recordMissionCleared, type StrikeOutcome } from '../practice/strikes'

interface PracticeDocument {
  schemaVersion: 1
  strikes: Record<string, number>
  solutionUnlocked: Record<string, boolean>
  /** Which mission's solution the Solution window should show. Written before that window opens. */
  solutionView: string | null
}

const CHANNEL_NAME = 'pydisc-practice'

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3

export const usePracticeStore = defineStore('practice', () => {
  const strikes = ref<Record<string, number>>({})
  const solutionUnlocked = ref<Record<string, boolean>>({})
  const solutionView = ref<string | null>(null)
  const isLoaded = ref(false)

  let channel: BroadcastChannel | null = null
  let isApplyingRemote = false

  function readDocument(stored: Partial<PracticeDocument> | null | undefined): void {
    strikes.value = Object.fromEntries(Object.entries(stored?.strikes ?? {}).filter(([, count]) => isCount(count)))
    solutionUnlocked.value = Object.fromEntries(Object.entries(stored?.solutionUnlocked ?? {}).filter(([, flag]) => flag === true))
    solutionView.value = typeof stored?.solutionView === 'string' ? stored.solutionView : null
  }

  async function load(): Promise<void> {
    if (isLoaded.value) return
    try {
      readDocument(await loadDocument<Partial<PracticeDocument>>('practice'))
    } catch (error) {
      console.warn('practice data could not be loaded, starting fresh', error)
    }
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = (event: MessageEvent) => {
        isApplyingRemote = true
        readDocument(event.data)
        isApplyingRemote = false
      }
    }
    isLoaded.value = true
  }

  const snapshot = (): PracticeDocument => ({
    schemaVersion: 1,
    strikes: { ...strikes.value },
    solutionUnlocked: { ...solutionUnlocked.value },
    solutionView: solutionView.value,
  })

  watch([strikes, solutionUnlocked, solutionView], () => {
    if (!isLoaded.value || isApplyingRemote) return
    const document_ = snapshot()
    try {
      channel?.postMessage(document_)
    } catch (error) {
      console.warn('practice data could not be shared with other windows', error)
    }
    saveDocument('practice', document_).catch((error) => console.warn('practice data could not be saved', error))
  }, { deep: true })

  function registerFailedCheck(missionId: string): StrikeOutcome {
    const state = { strikes: { ...strikes.value }, solutionUnlocked: { ...solutionUnlocked.value } }
    const outcome = recordFailedCheck(state, missionId)
    strikes.value = state.strikes
    solutionUnlocked.value = state.solutionUnlocked
    return outcome
  }

  function registerMissionCleared(missionId: string): void {
    const state = { strikes: { ...strikes.value }, solutionUnlocked: { ...solutionUnlocked.value } }
    recordMissionCleared(state, missionId)
    strikes.value = state.strikes
    solutionUnlocked.value = state.solutionUnlocked
  }

  return {
    strikes, solutionUnlocked, solutionView, isLoaded,
    load, registerFailedCheck, registerMissionCleared,
    strikesFor: (missionId: string) => strikes.value[missionId] ?? 0,
    canViewSolution: (missionId: string) => solutionUnlocked.value[missionId] === true,
    /** Points the Solution window at a mission, makes sure that choice is on disk, then opens the window. */
    async openSolution(missionId: string): Promise<void> {
      solutionView.value = missionId
      await saveDocument('practice', snapshot()).catch(() => undefined)
      await openSolutionWindow()
    },
  }
})
