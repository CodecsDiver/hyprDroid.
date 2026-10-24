<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { openThemeSite, THEME_SITE_URL } from '../../backend/backend'
import { useThemeStore } from '../../stores/themeStore'
import { useUiStore } from '../../stores/uiStore'
import { resolveToken } from '../../theme/applyTheme'
import { normalizeHex } from '../../theme/colors'
import { THEME_PRESETS } from '../../theme/presets'
import { PART_LABELS, THEME_TOKENS, TOKEN_BY_ID, TOKEN_GROUPS, type ThemeToken } from '../../theme/tokens'

const ui = useUiStore()
const theme = useThemeStore()

const importText = ref('')
const importMessage = ref('')
const importFailed = ref(false)
const newThemeName = ref('')
const isPicking = ref(false)
const focusedPart = ref<string | null>(null)
const copyMessage = ref('')

const visibleTokens = computed(() =>
  focusedPart.value ? THEME_TOKENS.filter((token) => token.parts.includes(focusedPart.value as string)) : THEME_TOKENS,
)
const visibleGroups = computed(() => TOKEN_GROUPS.filter((group) => visibleTokens.value.some((token) => token.group === group)))
const savedNames = computed(() => Object.keys(theme.saved))

const tokensInGroup = (group: string) => visibleTokens.value.filter((token) => token.group === group)
const valueOf = (token: ThemeToken) => resolveToken(token.id, theme.overrides)
const isOverridden = (token: ThemeToken) => theme.overrides[token.id] !== undefined
const followsLabel = (token: ThemeToken) => (token.fallbackOf && !isOverridden(token) ? TOKEN_BY_ID.get(token.fallbackOf)?.label : null)

function commitHex(token: ThemeToken, raw: string): void {
  if (normalizeHex(raw)) theme.setToken(token.id, raw)
}

function runImport(): void {
  const parsed = theme.importText(importText.value)
  importFailed.value = !parsed
  importMessage.value = parsed
    ? `Applied "${parsed.name}" (${Object.keys(parsed.overrides).length} colours set). ${parsed.notes.join(' ')}`.trim()
    : 'Nothing usable found. Paste a share link, JSON, CSS variables, or a list of hex colours.'
  if (parsed) importText.value = ''
}

async function pasteFromClipboard(): Promise<void> {
  try {
    importText.value = await navigator.clipboard.readText()
    runImport()
  } catch {
    importFailed.value = true
    importMessage.value = 'The clipboard could not be read here. Paste into the box instead (Ctrl+V).'
  }
}

async function copy(label: string, text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    copyMessage.value = `${label} copied.`
  } catch {
    importText.value = text
    copyMessage.value = `${label} is in the box above: select it and copy.`
  }
}

function saveCurrent(): void {
  theme.saveCurrent(newThemeName.value)
  newThemeName.value = ''
}

// --- pick an element -------------------------------------------------------------------------------

let hovered: Element | null = null
const clearHover = () => {
  hovered?.removeAttribute('data-theme-hover')
  hovered = null
}
const partOf = (target: EventTarget | null) =>
  target instanceof Element && !target.closest('.theme-editor') ? target.closest('[data-theme-part]') : null

function onPickMove(event: MouseEvent): void {
  const part = partOf(event.target)
  if (part === hovered) return
  clearHover()
  hovered = part
  hovered?.setAttribute('data-theme-hover', '')
}

function onPickClick(event: MouseEvent): void {
  if (target_is_editor(event.target)) return
  event.preventDefault()
  event.stopPropagation()
  const part = partOf(event.target)
  focusedPart.value = part?.getAttribute('data-theme-part') ?? 'global'
  stopPicking()
}

const target_is_editor = (target: EventTarget | null) => target instanceof Element && !!target.closest('.theme-editor')

function startPicking(): void {
  isPicking.value = true
  document.addEventListener('mousemove', onPickMove, true)
  document.addEventListener('click', onPickClick, true)
}

function stopPicking(): void {
  isPicking.value = false
  clearHover()
  document.removeEventListener('mousemove', onPickMove, true)
  document.removeEventListener('click', onPickClick, true)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !ui.isThemeEditorOpen) return
  if (isPicking.value) stopPicking()
  else ui.closeThemeEditor()
}

watch(() => ui.isThemeEditorOpen, (open) => !open && stopPicking())
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  stopPicking()
})
</script>

<template>
  <aside v-if="ui.isThemeEditorOpen" class="theme-editor panel" aria-label="Theme editor">
    <div class="panel-title">
      THEME &middot; {{ theme.activeName }}
      <button class="close" title="Close (Esc)" @click="ui.closeThemeEditor()">&#10005;</button>
    </div>
    <div class="body">
      <div v-if="theme.pendingFromLink" class="notice">
        This page was opened with a theme: <b>{{ theme.pendingFromLink.name }}</b>.
        <div class="row">
          <button class="btn is-green" @click="theme.applyPendingLink()">Apply it</button>
          <button class="btn is-ghost" @click="theme.dismissLink()">Ignore</button>
        </div>
      </div>

      <section>
        <h3>Pick a part of the app</h3>
        <div class="row">
          <button class="btn" :class="isPicking ? 'is-amber' : ''" @click="isPicking ? stopPicking() : startPicking()">
            {{ isPicking ? 'Click a part... (Esc cancels)' : 'Click the app to edit a part' }}
          </button>
          <button v-if="focusedPart" class="btn is-ghost" @click="focusedPart = null">Show everything</button>
        </div>
        <p v-if="focusedPart" class="hint">Showing colours for: <b>{{ PART_LABELS[focusedPart] ?? focusedPart }}</b></p>
        <div class="chips">
          <button
            v-for="(label, part) in PART_LABELS"
            :key="part"
            class="chip-pick"
            :class="{ on: focusedPart === part }"
            @click="focusedPart = focusedPart === part ? null : part"
          >{{ label }}</button>
        </div>
      </section>

      <section>
        <h3>Colour Theme Park</h3>
        <p class="hint">
          Design a palette on <b>{{ THEME_SITE_URL.replace('https://', '') }}</b>, then paste its share link, JSON, CSS variables or hex colours below.
        </p>
        <div class="row">
          <button class="btn is-violet" @click="openThemeSite()">Open the site</button>
          <button class="btn is-ghost" @click="pasteFromClipboard()">Paste from clipboard</button>
        </div>
        <textarea v-model="importText" class="import-box" rows="3" spellcheck="false" placeholder="Paste a theme link, JSON, :root { --x: #fff }, or #0b0c10 #1f2833 #66fcf1 ..." />
        <div class="row">
          <button class="btn is-green" :disabled="!importText.trim()" @click="runImport()">Import</button>
        </div>
        <p v-if="importMessage" class="message" :class="{ bad: importFailed }">{{ importMessage }}</p>
        <div class="row">
          <button class="btn is-ghost" @click="copy('Share link', theme.shareLink())">Copy share link</button>
          <button class="btn is-ghost" @click="copy('Theme JSON', theme.exportJson())">Copy JSON</button>
          <button class="btn is-ghost" @click="copy('CSS', theme.exportCss())">Copy CSS</button>
        </div>
        <p v-if="copyMessage" class="message">{{ copyMessage }}</p>
      </section>

      <section>
        <h3>Presets &amp; saved themes</h3>
        <div class="chips">
          <button v-for="preset in THEME_PRESETS" :key="preset.name" class="chip-pick" :title="preset.description" :class="{ on: theme.activeName === preset.name }" @click="theme.useTheme(preset.name, preset.overrides)">{{ preset.name }}</button>
        </div>
        <div v-if="savedNames.length" class="chips">
          <span v-for="name in savedNames" :key="name" class="saved">
            <button class="chip-pick" :class="{ on: theme.activeName === name }" @click="theme.useTheme(name, theme.saved[name])">{{ name }}</button>
            <button class="remove" :title="`Delete ${name}`" @click="theme.deleteSaved(name)">&#10005;</button>
          </span>
        </div>
        <div class="row">
          <input v-model="newThemeName" class="text-input" type="text" maxlength="60" placeholder="Name this theme" @keydown.enter="saveCurrent()" />
          <button class="btn is-green" :disabled="!newThemeName.trim()" @click="saveCurrent()">Save</button>
        </div>
        <div class="row"><button class="btn is-red" @click="theme.resetAll()">Reset everything</button></div>
      </section>

      <section v-for="group in visibleGroups" :key="group">
        <h3>{{ group }}</h3>
        <div v-for="token in tokensInGroup(group)" :key="token.id" class="token" :class="{ changed: isOverridden(token) }">
          <label class="token-label" :for="`token-${token.id}`">
            {{ token.label }}
            <small v-if="followsLabel(token)">follows {{ followsLabel(token) }}</small>
          </label>
          <template v-if="token.kind === 'color'">
            <input :id="`token-${token.id}`" type="color" :value="valueOf(token)" @input="theme.setToken(token.id, ($event.target as HTMLInputElement).value)" />
            <input class="hex" type="text" :value="valueOf(token)" maxlength="7" spellcheck="false" @change="commitHex(token, ($event.target as HTMLInputElement).value)" />
          </template>
          <template v-else-if="token.kind === 'number'">
            <input :id="`token-${token.id}`" type="range" :min="token.min" :max="token.max" :step="token.step" :value="valueOf(token)" @input="theme.setToken(token.id, ($event.target as HTMLInputElement).value)" />
            <span class="number">{{ valueOf(token) }}{{ token.unit ?? '' }}</span>
          </template>
          <input v-else :id="`token-${token.id}`" class="font-input" type="text" :value="valueOf(token)" spellcheck="false" @change="theme.setToken(token.id, ($event.target as HTMLInputElement).value)" />
          <button class="reset" :disabled="!isOverridden(token)" title="Back to default" @click="theme.resetToken(token.id)">&#8634;</button>
        </div>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.theme-editor {
  position: fixed; top: 44px; right: 0; bottom: 0; z-index: 900;
  width: min(440px, 100vw); display: flex; flex-direction: column;
  background: rgb(var(--hull-rgb) / 0.97); backdrop-filter: blur(6px);
  box-shadow: -12px 0 40px rgb(var(--void-rgb) / 0.6);
}
.panel-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.close { background: none; border: 0; color: var(--text-dim); cursor: pointer; font-size: 14px; }
.close:hover { color: var(--neon-red); }
.body { flex: 1; overflow-y: auto; padding: 12px 14px 24px; display: flex; flex-direction: column; gap: 18px; user-select: text; -webkit-user-select: text; }
h3 { margin: 0 0 8px; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--neon-cyan); }
.hint { margin: 6px 0; font-size: 11px; color: var(--text-dim); line-height: 1.5; }
.notice { padding: 10px; border: 1px solid var(--neon-amber); background: rgb(var(--neon-amber-rgb) / 0.1); font-size: 12px; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 8px 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.chip-pick { padding: 4px 9px; font-size: 11px; background: var(--hull-raised); color: var(--text); border: 1px solid rgb(var(--neon-cyan-rgb) / 0.3); cursor: pointer; }
.chip-pick:hover, .chip-pick.on { border-color: var(--neon-cyan); color: var(--neon-cyan); }
.saved { display: inline-flex; }
.remove { border: 1px solid rgb(var(--neon-cyan-rgb) / 0.3); border-left: 0; background: var(--hull-raised); color: var(--text-dim); cursor: pointer; font-size: 10px; }
.remove:hover { color: var(--neon-red); }
.import-box { width: 100%; resize: vertical; background: var(--editor-bg); color: var(--text); border: 1px solid var(--glass-edge); padding: 8px; font-family: var(--font-ui); font-size: 11px; }
.text-input { flex: 1; min-width: 120px; background: var(--hull-raised); color: var(--text); border: 1px solid var(--glass-edge); padding: 6px 8px; font-family: inherit; }
.message { margin: 4px 0; font-size: 11px; color: var(--neon-green); line-height: 1.5; }
.message.bad { color: var(--neon-red); }
.token { display: grid; grid-template-columns: minmax(0, 1fr) 34px 78px 24px; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid rgb(var(--text-dim-rgb) / 0.12); }
.token.changed .token-label { color: var(--neon-amber); }
.token-label { display: flex; flex-direction: column; font-size: 12px; }
.token-label small { font-size: 10px; color: var(--text-dim); }
.token input[type='color'] { width: 34px; height: 26px; padding: 0; border: 1px solid var(--glass-edge); background: none; cursor: pointer; }
.token input[type='range'] { grid-column: 2 / 4; accent-color: var(--neon-violet); width: 100%; }
.token .number { display: none; }
.hex { width: 78px; background: var(--hull-raised); color: var(--text); border: 1px solid var(--glass-edge); padding: 4px; font-family: inherit; font-size: 11px; }
.font-input { grid-column: 2 / 4; width: 100%; background: var(--hull-raised); color: var(--text); border: 1px solid var(--glass-edge); padding: 4px; font-family: inherit; font-size: 11px; }
.reset { background: none; border: 0; color: var(--text-dim); cursor: pointer; font-size: 14px; }
.reset:hover:not(:disabled) { color: var(--neon-amber); }
.reset:disabled { opacity: 0.25; cursor: default; }
</style>
