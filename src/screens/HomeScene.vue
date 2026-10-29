<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { AmbientPlayer, playSfx, unlockAudio } from '@/audio/engine'
import { entrance, pauseEntranceMusic, resumeEntranceMusic, setEntranceVolume, stopEntranceMusic } from '@/audio/entrance'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import LoadingState from '@/components/LoadingState.vue'
import NoteReveal from '@/components/NoteReveal.vue'
import ObjectNavigator from '@/components/ObjectNavigator.vue'
import StatusBar from '@/components/StatusBar.vue'
import { DEFAULT_MANIFEST, createAssetResolver, validateManifest } from '@/assets/manifest'
import { fileUrl } from '@/data/files'
import { fetchDates } from '@/data/repos/keepsakes'
import { fetchMemories } from '@/data/repos/vault'
import { describeDate, localDay, todaysDates } from '@/domain/importantDates'
import { unreadForObject } from '@/domain/notes'
import { MOODS } from '@/domain/moods'
import { roseStage } from '@/domain/rose'
import EffectsLayer from '@/effects/EffectsLayer.vue'
import { playEffect } from '@/effects/bus'
import { PANELS } from '@/features/panels'
import { INTERACTIONS, INTERACTION_IDS, getInteraction } from '@/registry/interactionRegistry'
import type { SceneController } from '@/scene/SceneController'
import { home, partnerName, refreshBondXp } from '@/state/household'
import { broadcastHeart, dismissOutboxFailure, live, onPartnerHeart, onTableChange, startLive, stopLive } from '@/state/live'
import { environment, moods, refreshMoods, useEnvironmentClock } from '@/state/moods'
import { gardenPlacements, refreshPlants } from '@/state/gardenState'
import { notes, refreshNotes, unreadCounts } from '@/state/notes'
import { inboxEntries, registerEventHandlers } from '@/state/eventHandlers'
import { isReducedMotion, prefs, reducedMotion, resolveQuality } from '@/state/prefs'
import { session } from '@/state/session'
import { refreshStickers } from '@/state/stickers'
import { showToast } from '@/state/toasts'
import { closePanel, isPanelId, openPanel, ui } from '@/state/ui'

void inboxEntries // keep the inbox store alive for panels that read it
const host = ref<HTMLElement | null>(null)
const scene = shallowRef<SceneController | null>(null)
const sceneState = ref<'loading' | 'ready' | 'unavailable'>('loading')
const sceneNote = ref('')
const hoverLabel = ref('')
const reveal = ref<{ note: ReturnType<typeof unreadForObject>[number]; remaining: number } | null>(null)
const ambient = new AmbientPlayer()
let stopHandlers: (() => void) | null = null
let disposed = false

useEnvironmentClock()

// ------------------------------------------------------------ scene lifecycle
function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

async function mountScene(): Promise<void> {
  if (!host.value) return
  if (!webglAvailable()) {
    sceneState.value = 'unavailable'
    sceneNote.value = 'Your browser could not start 3D graphics. Everything still works from the “Go to…” menu.'
    return
  }
  try {
    const issues = validateManifest(DEFAULT_MANIFEST, INTERACTION_IDS)
    issues.forEach((issue) => console.warn(`[manifest] ${issue.path}: ${issue.message}`))
    const { SceneController } = await import('@/scene/SceneController')
    const created = await SceneController.create({
      host: host.value,
      manifest: DEFAULT_MANIFEST,
      resolver: createAssetResolver(fileUrl),
      quality: resolveQuality(),
      isReducedMotion,
      onSelect: (id) => activate(id),
      onHover: (id) => (hoverLabel.value = id ? (getInteraction(id)?.label ?? '') : ''),
      onContextLost: () => showToast('The 3D view paused. It will resume automatically.', { tone: 'warning' }),
    })
    if (disposed) return created.dispose()
    scene.value = created
    sceneState.value = 'ready'
    if (created.info.placeholders.length > 0) sceneNote.value = 'Placeholder room: final Blender artwork has not been added yet.'
    applyAll()
  } catch (error) {
    console.error('[scene] failed to start', error)
    sceneState.value = 'unavailable'
    sceneNote.value = 'The 3D room could not start. Everything still works from the “Go to…” menu.'
  }
}

// ------------------------------------------------------------ photo wall (shared photos only)
async function refreshWall(): Promise<void> {
  try {
    const photos = (await fetchMemories()).filter((m) => m.kind === 'photo' && m.visibility === 'shared' && m.fileId)
    scene.value?.setPhotos(photos.map((m) => fileUrl(m.fileId!)).filter(Boolean))
  } catch {
    /* the wall is decoration */
  }
}

// ------------------------------------------------------------ days that matter
async function celebrateToday(): Promise<void> {
  try {
    const today = localDay(new Date())
    const dates = todaysDates(await fetchDates(), today)
    if (dates.length === 0) return
    const first = dates[0]!
    const { badge } = describeDate(first, today)
    showToast(`Today: ${first.title}${badge ? ` (${badge})` : ''} 🎉`, { tone: 'success', timeoutMs: 9000 })
    playEffect({ type: 'reaction', emoji: first.kind === 'birthday' ? '🎂' : '🎉', animation: 'burst' }, 3200)
    playSfx('love')
  } catch {
    /* nothing to celebrate */
  }
}

function applyAll(): void {
  const s = scene.value
  if (!s) return
  s.setEnvironment(environment.value)
  s.setRoseStage(roseStage(home.bondXp))
  s.setUnreadNotes(unreadCounts.value)
  s.setGarden(gardenPlacements.value)
  void refreshWall()
  syncSelection()
}

watch(environment, (env) => scene.value?.setEnvironment(env))
watch(() => home.bondXp, (xp) => scene.value?.setRoseStage(roseStage(xp)))
watch(unreadCounts, (counts) => scene.value?.setUnreadNotes(counts))
watch(gardenPlacements, (placements) => scene.value?.setGarden(placements))

// ------------------------------------------------------------ ambient audio
// The entrance album follows the sound switch and volume (it started on the tap that came in).
watch(() => prefs.soundOn, (on) => (on ? resumeEntranceMusic() : pauseEntranceMusic()))
watch(() => prefs.volume, (volume) => setEntranceVolume(volume))

watch(() => [environment.value.ambient, prefs.soundOn] as const, ([id, on]) => void ambient.set(on ? id : null), { immediate: true })

// ------------------------------------------------------------ activation & panels
function panelObjectId(panel: string | null): string | null {
  if (!panel) return null
  return INTERACTIONS.find((d) => d.behavior.type === 'panel' && d.behavior.panel === panel)?.id ?? null
}

function syncSelection(): void {
  const s = scene.value
  if (!s) return
  const id = ui.objectId ?? panelObjectId(ui.panel)
  const fullscreen = ui.panel ? PANELS[ui.panel].fullscreen === true : false
  s.setSelected(fullscreen ? null : id)
  s.focusObject(fullscreen ? null : id)
  const open = !!ui.panel && !fullscreen
  const wide = window.matchMedia('(min-width: 760px)').matches
  // The panel is a bottom sheet on phones and a side card on wide screens: keep the object in the free area.
  s.setPanelInset(!open ? { x: 0, y: 0 } : wide ? { x: 215, y: 0 } : { x: 0, y: window.innerHeight * 0.18 })
  s.setPaused(fullscreen) // full-screen experiences cover the room: stop drawing it
}
watch(() => [ui.panel, ui.objectId], syncSelection)

function activate(id: string): void {
  const definition = getInteraction(id)
  if (!definition) return
  unlockAudio()
  playSfx(definition.sfx)
  scene.value?.pulse(id)

  if (definition.noteTarget && session.userId) {
    const waiting = unreadForObject(notes.value, session.userId, id)
    if (waiting[0]) {
      reveal.value = { note: waiting[0], remaining: waiting.length - 1 }
      return
    }
  }
  if (definition.behavior.type === 'action') {
    prefs.lampOn = !prefs.lampOn
    showToast(prefs.lampOn ? 'Lamp on.' : 'Lamp off.', { timeoutMs: 1500 })
    return
  }
  openPanel(definition.behavior.panel, id)
}

function closeReveal(): void {
  const closed = reveal.value
  reveal.value = null
  if (!closed || !session.userId) return
  // Chain to the next waiting note only if this one was actually opened (and so is now read).
  const wasRead = notes.value.find((n) => n.id === closed.note.id)?.readAt != null
  if (!wasRead) return
  const next = unreadForObject(notes.value, session.userId, closed.note.objectId)
  if (next[0]) reveal.value = { note: next[0], remaining: next.length - 1 }
}

// Browser history: the back button closes a panel.
let pushed = false
function syncHashToPanel(): void {
  const wanted = ui.panel ? `#/${ui.panel}` : ''
  if (ui.panel && location.hash !== wanted) {
    if (pushed) history.replaceState(null, '', wanted)
    else {
      history.pushState(null, '', wanted)
      pushed = true
    }
  } else if (!ui.panel && pushed) {
    pushed = false
    if (location.hash.startsWith('#/')) history.back()
  }
}
watch(() => ui.panel, syncHashToPanel)

function onHashChange(): void {
  const match = /^#\/([a-z-]+)$/.exec(location.hash)
  const target = match?.[1]
  if (target && isPanelId(target)) {
    if (ui.panel !== target) openPanel(target)
  } else if (ui.panel) {
    pushed = false
    closePanel()
  }
}

// Undeliverable messages (e.g. mischief the partner has not opted into) are reported, not silently lost.
watch(() => live.failures.length, (count, previous) => {
  if (count <= previous) return
  const failure = live.failures[count - 1]
  if (!failure) return
  showToast(failure.message, { tone: 'warning', timeoutMs: 6000 })
  dismissOutboxFailure(failure.id)
})

// ------------------------------------------------------------ keyboard camera
function onSceneKey(event: KeyboardEvent): void {
  const map: Record<string, 'left' | 'right' | 'in' | 'out'> = { ArrowLeft: 'left', ArrowRight: 'right', '+': 'in', '=': 'in', '-': 'out', _: 'out' }
  const action = map[event.key]
  if (action) {
    event.preventDefault()
    scene.value?.nudge(action)
  }
}

// ------------------------------------------------------------ data + realtime
const offTables: (() => void)[] = []
async function boot(): Promise<void> {
  if (!session.userId) return
  await startLive({ userId: session.userId }, (error) => console.warn('[inbox]', error))
  stopHandlers = registerEventHandlers()
  offTables.push(
    onTableChange('moods', () => void refreshMoods().catch(() => {})),
    onTableChange('hidden_notes', () => void refreshNotes().catch(() => {})),
    onTableChange('garden_plants', () => void refreshPlants().catch(() => {})),
    onTableChange('household_state', () => void refreshBondXp()),
    onTableChange('stickers', () => void refreshStickers().catch(() => {})),
    onTableChange('memories', () => void refreshWall()),
    // A live "I'm here" pulse from the partner. (The Love Universe shows its own, richer version.)
    onPartnerHeart(() => {
      if (ui.panel === 'love-universe') return
      playEffect({ type: 'reaction', emoji: '💗', animation: 'pulse' }, 1800)
      playSfx('pop')
    }),
  )
  await Promise.allSettled([refreshMoods(), refreshNotes(), refreshPlants()])
  void celebrateToday()
  // A sealed note opens at midnight even if the page has been open all night.
  noteTimer = setInterval(() => void refreshNotes().catch(() => {}), 10 * 60_000)
  if (location.hash.startsWith('#postcard=')) openPanel('postcards') // a postcard link was opened: take them straight to it
}
let noteTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  void mountScene()
  void boot()
  window.addEventListener('hashchange', onHashChange)
  window.addEventListener('pointerdown', unlockAudio, { once: true })
  window.addEventListener('pointerdown', () => ambient.refresh(), { once: true })
  onHashChange()
})

onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('hashchange', onHashChange)
  stopHandlers?.()
  if (noteTimer) clearInterval(noteTimer)
  stopEntranceMusic()
  offTables.forEach((off) => off())
  stopLive()
  ambient.dispose()
  scene.value?.dispose()
  scene.value = null
})

// ------------------------------------------------------------ HUD helpers
const partnerMood = computed(() => {
  const snapshot = moods.value.find((m) => m.userId === home.partner?.id)
  if (!snapshot) return null
  const stale = Date.now() - Date.parse(snapshot.updatedAt) > 36 * 3600 * 1000
  return stale ? null : snapshot
})
const calloutText = computed(() => (partnerMood.value ? MOODS[partnerMood.value.mood].callout(partnerName.value) : ''))
const activeDefinition = computed(() => (ui.panel ? PANELS[ui.panel] : null))
const heartTip = ref(false)

function pingHeart(): void {
  // The heart-button in the HUD is a quick shortcut: ephemeral "I'm here" pulse to the partner.
  broadcastHeart()
  heartTip.value = true
  setTimeout(() => (heartTip.value = false), 1200)
}
</script>

<template>
  <div class="home" :class="{ 'home--reduced': reducedMotion }">
    <div
      ref="host"
      class="home__scene"
      role="group"
      aria-label="Interactive room. Use the Go to menu to open things, or arrow keys to turn the room."
      tabindex="0"
      @keydown="onSceneKey"
    />
    <LoadingState v-if="sceneState === 'loading'" class="home__loading" label="Setting up the room…" />
    <p v-if="sceneNote" class="home__note" role="note">{{ sceneNote }}</p>

    <header class="hud hud--top">
      <StatusBar />
      <h1 class="hud__title">Signal Home</h1>
      <div class="row hud__actions">
        <button v-if="entrance.active" type="button" class="btn btn--small btn--quiet" :aria-pressed="entrance.playing" :aria-label="entrance.playing ? 'Pause the entrance album' : 'Play the entrance album'" @click="entrance.playing ? pauseEntranceMusic() : resumeEntranceMusic()">
          <span aria-hidden="true">{{ entrance.playing ? '🎵' : '▶️' }}</span>
        </button>
        <button type="button" class="btn btn--small btn--quiet" :aria-pressed="prefs.soundOn" :aria-label="prefs.soundOn ? 'Mute sound' : 'Turn sound on'" @click="prefs.soundOn = !prefs.soundOn">
          <span aria-hidden="true">{{ prefs.soundOn ? '🔊' : '🔇' }}</span>
        </button>
        <button type="button" class="btn btn--small btn--quiet" aria-label="Settings" @click="openPanel('settings')"><span aria-hidden="true">⚙️</span></button>
      </div>
    </header>

    <p v-if="hoverLabel" class="hover-label" aria-hidden="true">{{ hoverLabel }}</p>
    <p v-if="calloutText && !ui.panel" class="callout" role="status">{{ calloutText }}</p>
    <p v-if="heartTip" class="callout" role="status">Sent a little "I'm here" to {{ partnerName }}.</p>

    <footer class="hud hud--bottom">
      <ObjectNavigator @activate="activate" @focus-object="(id) => scene?.setFocused(id)" />
      <button type="button" class="btn heartbtn" aria-label="Send a tiny 'I'm here' pulse" @click="pingHeart"><span aria-hidden="true">♥</span></button>
    </footer>

    <ErrorBoundary v-if="ui.panel && activeDefinition" :key="ui.panel" :label="activeDefinition.title">
      <component :is="activeDefinition.component" :definition="activeDefinition" @close="closePanel" />
    </ErrorBoundary>

    <NoteReveal v-if="reveal" :key="reveal.note.id" :note="reveal.note" :remaining="reveal.remaining" @close="closeReveal" />
    <EffectsLayer />
  </div>
</template>

<style scoped>
.home { position: absolute; inset: 0; }
.home__scene { position: absolute; inset: 0; z-index: var(--layer-scene); touch-action: none; outline: none; }
.home__scene:focus-visible { box-shadow: inset 0 0 0 3px var(--color-gold); }
.home__loading { position: absolute; inset: 0; z-index: var(--layer-hud); pointer-events: none; align-content: center; }
.home__note { position: absolute; z-index: var(--layer-hud); left: var(--gutter); right: var(--gutter); top: calc(var(--safe-top) + 84px); margin: 0; text-align: center; font-size: var(--text-xs); color: var(--color-ink-faint); pointer-events: none; }
.hud { position: absolute; z-index: var(--layer-hud); left: 0; right: 0; padding-left: max(var(--gutter), var(--safe-left)); padding-right: max(var(--gutter), var(--safe-right)); pointer-events: none; }
.hud > * { pointer-events: auto; }
.hud--top { top: 0; padding-top: calc(var(--safe-top) + var(--space-3)); display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-2); }
.hud__title { position: absolute; left: 50%; top: calc(var(--safe-top) + var(--space-3)); transform: translateX(-50%); font-size: var(--text-xl); text-shadow: 0 4px 12px #000; pointer-events: none; white-space: nowrap; }
.hud__actions { margin-left: auto; flex-wrap: nowrap; }
.hud--bottom { bottom: 0; padding-bottom: calc(var(--safe-bottom) + var(--space-3)); display: grid; grid-template-columns: 1fr auto; gap: var(--space-2); }
.heartbtn { width: var(--tap-target); padding: 0; color: var(--color-rose); font-size: 1.4rem; }
.banner { position: absolute; z-index: var(--layer-hud); left: var(--gutter); right: var(--gutter); top: calc(var(--safe-top) + 120px); max-width: 480px; margin-inline: auto; background: var(--surface-panel); }
.banner p { margin: 0 0 var(--space-2); font-size: var(--text-sm); }
.hover-label { position: absolute; z-index: var(--layer-hud); left: 50%; bottom: calc(var(--safe-bottom) + 160px); transform: translateX(-50%); margin: 0; padding: 2px var(--space-3); border-radius: var(--radius-pill); background: rgba(0, 0, 0, 0.6); font-size: var(--text-sm); pointer-events: none; }
.callout { position: absolute; z-index: var(--layer-hud); left: var(--gutter); right: var(--gutter); bottom: calc(var(--safe-bottom) + 84px); margin: 0; max-width: 440px; margin-inline: auto; padding: var(--space-2) var(--space-3); border: 1px solid var(--line-gold); border-radius: var(--radius-md); background: linear-gradient(180deg, rgba(38, 20, 38, 0.7), rgba(12, 6, 22, 0.62)); backdrop-filter: blur(10px); text-align: center; font-size: var(--text-sm); font-weight: 700; pointer-events: none; }
@media (max-width: 520px) { .hud__title { font-size: var(--text-lg); top: calc(var(--safe-top) + 44px); } .hud--top { flex-direction: column; align-items: stretch; } .hud__actions { position: absolute; right: max(var(--gutter), var(--safe-right)); top: calc(var(--safe-top) + var(--space-3)); } }
</style>
