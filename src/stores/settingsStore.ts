import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { loadDocument, saveDocument } from '../backend/backend'

export type AnimationIntensity = 'off' | 'low' | 'medium' | 'high'

interface SettingsDocument {
  schemaVersion: 1
  animationIntensity: AnimationIntensity
  soundEnabled: boolean
  screenShakeEnabled: boolean
  focusMode: boolean
}

const INTENSITIES: AnimationIntensity[] = ['off', 'low', 'medium', 'high']

export const FX_SCALE_BY_INTENSITY: Record<AnimationIntensity, number> = { off: 0, low: 0.4, medium: 1, high: 1.6 }

export const useSettingsStore = defineStore('settings', () => {
  const animationIntensity = ref<AnimationIntensity>('high')
  const soundEnabled = ref(true)
  const screenShakeEnabled = ref(true)
  const focusMode = ref(false)
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
      }
    } catch (error) {
      console.warn('settings could not be loaded, using defaults', error)
    }
    applyToDocument()
    isLoaded.value = true
  }

  watch([animationIntensity, soundEnabled, screenShakeEnabled, focusMode], () => {
    applyToDocument()
    if (!isLoaded.value) return
    const document_: SettingsDocument = {
      schemaVersion: 1,
      animationIntensity: animationIntensity.value,
      soundEnabled: soundEnabled.value,
      screenShakeEnabled: screenShakeEnabled.value,
      focusMode: focusMode.value,
    }
    saveDocument('settings', document_).catch((error) => console.warn('settings could not be saved', error))
  })

  return { animationIntensity, soundEnabled, screenShakeEnabled, focusMode, isLoaded, fxScale, load }
})
