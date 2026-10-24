import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { loadDocument, saveDocument } from '../backend/backend'
import { applyThemeOverrides, sanitizeOverrides, toCssText, updateAccentHues, type ThemeOverrides } from '../theme/applyTheme'
import { parseThemeInput, type ImportedTheme } from '../theme/importTheme'
import { TOKEN_BY_ID } from '../theme/tokens'

interface ThemeDocument {
  schemaVersion: 1
  overrides: ThemeOverrides
  activeName: string
  saved: Record<string, ThemeOverrides>
}

const MAX_SAVED_THEMES = 40
const CHANNEL_NAME = 'pydisc-theme'
const LINK_KEYS = ['theme', 'colors', 'palette', 'data']

export const useThemeStore = defineStore('theme', () => {
  const overrides = ref<ThemeOverrides>({})
  const activeName = ref('Cyber (default)')
  const saved = ref<Record<string, ThemeOverrides>>({})
  const pendingFromLink = ref<ImportedTheme | null>(null)
  const isLoaded = ref(false)

  let channel: BroadcastChannel | null = null
  /** The last document sent or received. Equal documents are never sent again, so two windows cannot echo forever. */
  let lastSerialized = ''
  const serialize = () => JSON.stringify({ overrides: overrides.value, activeName: activeName.value, saved: saved.value })

  function applyToPage(): void {
    applyThemeOverrides(document.documentElement, overrides.value)
    updateAccentHues(overrides.value)
  }

  function readLink(): ImportedTheme | null {
    const params = new URLSearchParams(location.search)
    const hashParams = new URLSearchParams(location.hash.replace(/^#\/?\??/, ''))
    if (!LINK_KEYS.some((key) => params.has(key) || hashParams.has(key))) return null
    return parseThemeInput(location.href)
  }

  async function load(): Promise<void> {
    if (isLoaded.value) return
    try {
      const stored = await loadDocument<Partial<ThemeDocument>>('theme')
      if (stored) {
        overrides.value = sanitizeOverrides(stored.overrides)
        if (typeof stored.activeName === 'string') activeName.value = stored.activeName.slice(0, 60)
        const cleanSaved: Record<string, ThemeOverrides> = {}
        for (const [name, value] of Object.entries(stored.saved ?? {}).slice(0, MAX_SAVED_THEMES)) cleanSaved[name.slice(0, 60)] = sanitizeOverrides(value)
        saved.value = cleanSaved
      }
    } catch (error) {
      console.warn('theme could not be loaded, using defaults', error)
    }
    applyToPage()
    pendingFromLink.value = readLink()
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = (event: MessageEvent) => {
        overrides.value = sanitizeOverrides(event.data?.overrides)
        if (typeof event.data?.activeName === 'string') activeName.value = event.data.activeName.slice(0, 60)
        lastSerialized = serialize()
      }
    }
    isLoaded.value = true
  }

  watch([overrides, activeName, saved], () => {
    applyToPage()
    if (!isLoaded.value) return
    const serialized = serialize()
    if (serialized === lastSerialized) return
    lastSerialized = serialized
    try {
      channel?.postMessage({ overrides: { ...overrides.value }, activeName: activeName.value })
    } catch (error) {
      console.warn('theme could not be shared with other windows', error)
    }
    const document_: ThemeDocument = { schemaVersion: 1, overrides: overrides.value, activeName: activeName.value, saved: saved.value }
    saveDocument('theme', document_).catch((error) => console.warn('theme could not be saved', error))
  }, { deep: true })

  function setToken(id: string, value: string): boolean {
    const token = TOKEN_BY_ID.get(id)
    if (!token) return false
    const clean = sanitizeOverrides({ [id]: value })[id]
    if (clean === undefined) return false
    overrides.value = { ...overrides.value, [id]: clean }
    activeName.value = 'Custom'
    return true
  }

  function resetToken(id: string): void {
    const { [id]: _removed, ...rest } = overrides.value
    overrides.value = rest
    activeName.value = 'Custom'
  }

  function useTheme(name: string, next: ThemeOverrides): void {
    overrides.value = sanitizeOverrides(next)
    activeName.value = name
  }

  function saveCurrent(name: string): void {
    const trimmed = name.trim().slice(0, 60)
    if (!trimmed) return
    if (Object.keys(saved.value).length >= MAX_SAVED_THEMES && !(trimmed in saved.value)) return
    saved.value = { ...saved.value, [trimmed]: { ...overrides.value } }
    activeName.value = trimmed
  }

  function deleteSaved(name: string): void {
    const { [name]: _removed, ...rest } = saved.value
    saved.value = rest
  }

  function importText(text: string): ImportedTheme | null {
    const parsed = parseThemeInput(text)
    if (!parsed || Object.keys(parsed.overrides).length === 0) return null
    useTheme(parsed.name, parsed.overrides)
    return parsed
  }

  function applyPendingLink(): void {
    if (!pendingFromLink.value) return
    useTheme(pendingFromLink.value.name, pendingFromLink.value.overrides)
    pendingFromLink.value = null
  }

  const exportJson = () => JSON.stringify({ name: activeName.value, overrides: overrides.value }, null, 2)
  const exportCss = () => toCssText(overrides.value)

  function shareLink(): string {
    const packed = btoa(unescape(encodeURIComponent(JSON.stringify({ name: activeName.value, overrides: overrides.value }))))
    const url = new URL(location.href)
    url.search = ''
    url.hash = ''
    url.searchParams.set('theme', packed.replace(/\+/g, '-').replace(/\//g, '_'))
    return url.toString()
  }

  return {
    overrides, activeName, saved, pendingFromLink, isLoaded,
    load, setToken, resetToken, useTheme, saveCurrent, deleteSaved, importText, applyPendingLink,
    exportJson, exportCss, shareLink,
    resetAll: () => useTheme('Cyber (default)', {}),
    dismissLink: () => (pendingFromLink.value = null),
  }
})
