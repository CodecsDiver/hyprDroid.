import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { loadDocument, openSolutionWindow, saveDocument } from '../backend/backend'
import { judgeAgainstGhost, sanitizeGhost, type GhostRecord, type GhostVerdict } from '../ghost/ghostRecord'
import { recordFailedCheck, recordMissionCleared, type StrikeOutcome } from '../practice/strikes'

interface PracticeDocument {
  schemaVersion: 1
  strikes: Record<string, number>
  solutionUnlocked: Record<string, boolean>
  /** Which mission's solution the Solution window should show. Written before that window opens. */
  solutionView: string | null
  /** The fastest recorded run per task: the ghost you race. */
  ghosts: Record<string, GhostRecord>
}

const CHANNEL_NAME = 'pydisc-practice'
const MAX_GHOSTS = 120

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3

export const usePracticeStore = defineStore('practice', () => {
  const strikes = ref<Record<string, number>>({})
  const solutionUnlocked = ref<Record<string, boolean>>({})
  const solutionView = ref<string | null>(null)
  const ghosts = ref<Record<string, GhostRecord>>({})
  const isLoaded = ref(false)

  let channel: BroadcastChannel | null = null
  /** The last document sent or received. Equal documents are never sent again, so two windows cannot echo forever. */
  let lastSerialized = ''

  function readDocument(stored: Partial<PracticeDocument> | null | undefined): void {
    strikes.value = Object.fromEntries(Object.entries(stored?.strikes ?? {}).filter(([, count]) => isCount(count)))
    solutionUnlocked.value = Object.fromEntries(Object.entries(stored?.solutionUnlocked ?? {}).filter(([, flag]) => flag === true))
    solutionView.value = typeof stored?.solutionView === 'string' ? stored.solutionView : null
    const cleanGhosts: Record<string, GhostRecord> = {}
    for (const [key, value] of Object.entries(stored?.ghosts ?? {}).slice(0, MAX_GHOSTS)) {
      const ghost = sanitizeGhost(key, value)
      if (ghost) cleanGhosts[key] = ghost
    }
    ghosts.value = cleanGhosts
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
        readDocument(event.data)
        lastSerialized = JSON.stringify(snapshot())
      }
    }
    isLoaded.value = true
  }

  const snapshot = (): PracticeDocument => ({
    schemaVersion: 1,
    strikes: { ...strikes.value },
    solutionUnlocked: { ...solutionUnlocked.value },
    solutionView: solutionView.value,
    ghosts: ghosts.value,
  })

  watch([strikes, solutionUnlocked, solutionView, ghosts], () => {
    if (!isLoaded.value) return
    const document_ = snapshot()
    const serialized = JSON.stringify(document_)
    if (serialized === lastSerialized) return
    lastSerialized = serialized
    try {
      // The document holds reactive proxies, which cannot be posted; a JSON copy can.
      channel?.postMessage(JSON.parse(serialized))
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
    strikes, solutionUnlocked, solutionView, ghosts, isLoaded,
    load, registerFailedCheck, registerMissionCleared,
    ghostFor: (key: string): GhostRecord | undefined => ghosts.value[key],
    /** Stores a finished run as the new ghost when it is the first or faster. Returns how it compared. */
    submitRun(record: GhostRecord): GhostVerdict {
      const verdict = judgeAgainstGhost(ghosts.value[record.key], record.ms)
      if (verdict !== 'slower' && (record.key in ghosts.value || Object.keys(ghosts.value).length < MAX_GHOSTS)) {
        ghosts.value = { ...ghosts.value, [record.key]: record }
      }
      return verdict
    },
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
