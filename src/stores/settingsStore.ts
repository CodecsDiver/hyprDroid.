import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { loadDocument, saveDocument } from '../backend/backend'
import { DEFAULT_LAYOUT, sanitizeLayout, type PanelLayout } from '../layout/resize'

export type AnimationIntensity = 'off' | 'low' | 'medium' | 'high'

interface SettingsDocument {
  schemaVersion: 1
  animationIntensity: AnimationIntensity
  soundEnabled: boolean
  screenShakeEnabled: boolean
  focusMode: boolean
  layout: PanelLayout
  panels: PanelVisibility
  editorFontSize: number
}

export interface PanelVisibility {
  missions: boolean
  quests: boolean
  output: boolean
}

export const MIN_EDITOR_FONT_SIZE = 10
export const MAX_EDITOR_FONT_SIZE = 30
export const DEFAULT_EDITOR_FONT_SIZE = 15

const INTENSITIES: AnimationIntensity[] = ['off', 'low', 'medium', 'high']

export const FX_SCALE_BY_INTENSITY: Record<AnimationIntensity, number> = { off: 0, low: 0.4, medium: 1, high: 1.6 }

export const useSettingsStore = defineStore('settings', () => {
  const animationIntensity = ref<AnimationIntensity>('high')
  const soundEnabled = ref(true)
  const screenShakeEnabled = ref(true)
  const focusMode = ref(false)
  const layout = ref<PanelLayout>({ ...DEFAULT_LAYOUT })
  const panels = ref<PanelVisibility>({ missions: true, quests: true, output: true })
  const editorFontSize = ref(DEFAULT_EDITOR_FONT_SIZE)
  const isLoaded = ref(false)

  const fxScale = () => FX_SCALE_BY_INTENSITY[animationIntensity.value]

  function applyToDocument(): void {
    document.documentElement.dataset.fx = animationIntensity.value
  }

  async function load(): Promise<void> {
    try {
      const stored = await loadDocument<Partial<SettingsDocument>>('settings')
      if (stored) {
        if (stored.animationIntensity && INTENSITIES.includes(stored.animationIntensity)) {
          animationIntensity.value = stored.animationIntensity
        }
        soundEnabled.value = stored.soundEnabled ?? soundEnabled.value
        screenShakeEnabled.value = stored.screenShakeEnabled ?? screenShakeEnabled.value
        focusMode.value = stored.focusMode ?? focusMode.value
        layout.value = sanitizeLayout(stored.layout)
        panels.value = {
          missions: stored.panels?.missions ?? true,
          quests: stored.panels?.quests ?? true,
          output: stored.panels?.output ?? true,
        }
        const storedFont = stored.editorFontSize
        if (typeof storedFont === 'number' && storedFont >= MIN_EDITOR_FONT_SIZE && storedFont <= MAX_EDITOR_FONT_SIZE) {
          editorFontSize.value = Math.round(storedFont)
        }
      }
    } catch (error) {
      console.warn('settings could not be loaded, using defaults', error)
    }
    applyToDocument()
    isLoaded.value = true
  }

  // deep: layout and panels are edited property-by-property (drag handles, menu toggles).
  watch([animationIntensity, soundEnabled, screenShakeEnabled, focusMode, layout, panels, editorFontSize], () => {
    applyToDocument()
    if (!isLoaded.value) return
    const document_: SettingsDocument = {
      schemaVersion: 1,
      animationIntensity: animationIntensity.value,
      soundEnabled: soundEnabled.value,
      screenShakeEnabled: screenShakeEnabled.value,
      focusMode: focusMode.value,
      layout: layout.value,
      panels: panels.value,
      editorFontSize: editorFontSize.value,
    }
    saveDocument('settings', document_).catch((error) => console.warn('settings could not be saved', error))
  }, { deep: true })

  function resetLayout(): void {
    layout.value = { ...DEFAULT_LAYOUT }
    panels.value = { missions: true, quests: true, output: true }
  }

  function changeEditorFontSize(delta: number): void {
    editorFontSize.value = Math.max(MIN_EDITOR_FONT_SIZE, Math.min(MAX_EDITOR_FONT_SIZE, editorFontSize.value + delta))
  }

  return {
    animationIntensity, soundEnabled, screenShakeEnabled, focusMode, layout, panels, editorFontSize,
    isLoaded, fxScale, load, resetLayout, changeEditorFontSize,
  }
})
