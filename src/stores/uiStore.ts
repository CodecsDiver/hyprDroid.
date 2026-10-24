import { defineStore } from 'pinia'
import { ref } from 'vue'

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
  | { kind: 'about' }
  | { kind: 'shortcuts' }

export const useUiStore = defineStore('ui', () => {
  const isPaletteOpen = ref(false)
  const dialog = ref<DialogRequest | null>(null)
  const isThemeEditorOpen = ref(false)

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
    isPaletteOpen, dialog, isThemeEditorOpen, confirm, prompt, submitPrompt, closeDialog,
    openThemeEditor: () => (isThemeEditorOpen.value = true),
    closeThemeEditor: () => (isThemeEditorOpen.value = false),
    openPalette: () => (isPaletteOpen.value = true),
    closePalette: () => (isPaletteOpen.value = false),
    showAbout: () => (dialog.value = { kind: 'about' }),
    showShortcuts: () => (dialog.value = { kind: 'shortcuts' }),
  }
})
