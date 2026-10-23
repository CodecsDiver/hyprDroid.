import { defineStore } from 'pinia'
import { ref } from 'vue'

export type DialogRequest =
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; resolve: (confirmed: boolean) => void }
  | { kind: 'about' }
  | { kind: 'shortcuts' }

export const useUiStore = defineStore('ui', () => {
  const isPaletteOpen = ref(false)
  const dialog = ref<DialogRequest | null>(null)

  function confirm(title: string, message: string, confirmLabel = 'Continue'): Promise<boolean> {
    return new Promise((resolve) => {
      dialog.value = { kind: 'confirm', title, message, confirmLabel, resolve }
    })
  }

  function closeDialog(confirmed = false): void {
    if (dialog.value?.kind === 'confirm') dialog.value.resolve(confirmed)
    dialog.value = null
  }

  return {
    isPaletteOpen, dialog, confirm, closeDialog,
    openPalette: () => (isPaletteOpen.value = true),
    closePalette: () => (isPaletteOpen.value = false),
    showAbout: () => (dialog.value = { kind: 'about' }),
    showShortcuts: () => (dialog.value = { kind: 'shortcuts' }),
  }
})
