import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SortFrame } from '../visualizers/algorithms/sorting'

export type DialogRequest =
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; resolve: (confirmed: boolean) => void }
  | {
      kind: 'prompt'
      title: string
      label: string
      initial: string
      confirmLabel: string
      validate: (value: string) => string | null
      resolve: (value: string | null) => void
    }
  | { kind: 'visualize'; fileName: string; frames: SortFrame[] }
  | { kind: 'about' }
  | { kind: 'shortcuts' }

export const useUiStore = defineStore('ui', () => {
  const isPaletteOpen = ref(false)
  const dialog = ref<DialogRequest | null>(null)
  const isThemeEditorOpen = ref(false)
  /** The mission being raced against its ghost, or null. */
  const raceMissionId = ref<string | null>(null)

  function confirm(title: string, message: string, confirmLabel = 'Continue'): Promise<boolean> {
    return new Promise((resolve) => {
      dialog.value = { kind: 'confirm', title, message, confirmLabel, resolve }
    })
  }

  function prompt(options: { title: string; label: string; initial: string; confirmLabel: string; validate: (value: string) => string | null }): Promise<string | null> {
    return new Promise((resolve) => {
      dialog.value = { kind: 'prompt', ...options, resolve }
    })
  }

  function submitPrompt(value: string): void {
    if (dialog.value?.kind !== 'prompt' || dialog.value.validate(value) !== null) return
    dialog.value.resolve(value)
    dialog.value = null
  }

  function closeDialog(confirmed = false): void {
    if (dialog.value?.kind === 'confirm') dialog.value.resolve(confirmed)
    if (dialog.value?.kind === 'prompt') dialog.value.resolve(null)
    dialog.value = null
  }

  return {
    isPaletteOpen, dialog, isThemeEditorOpen, raceMissionId, confirm, prompt, submitPrompt, closeDialog,
    startRace: (missionId: string) => (raceMissionId.value = missionId),
    endRace: () => (raceMissionId.value = null),
    openThemeEditor: () => (isThemeEditorOpen.value = true),
    closeThemeEditor: () => (isThemeEditorOpen.value = false),
    openPalette: () => (isPaletteOpen.value = true),
    closePalette: () => (isPaletteOpen.value = false),
    showVisualization: (fileName: string, frames: SortFrame[]) => (dialog.value = { kind: 'visualize', fileName, frames }),
    showAbout: () => (dialog.value = { kind: 'about' }),
    showShortcuts: () => (dialog.value = { kind: 'shortcuts' }),
  }
})
