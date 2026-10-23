<script setup lang="ts">
import { computed, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import PanelShell from '@/components/PanelShell.vue'
import ResourceView from '@/components/ResourceView.vue'
import { addTrack, createPlaylist, deletePlaylist, deleteTrack, fetchListeningState, fetchPlaylists, fetchTracks, setListeningConsent, setPlaylistTracks, type ListeningState, type Playlist, type Track } from '@/data/repos/music'
import { downscaleImage } from '@/data/imageTools'
import { fileUrl } from '@/data/files'
import { formatDuration } from '@/domain/time'
import { partnerName } from '@/state/household'
import { session } from '@/state/session'
import { useAction, useResource } from '@/state/useAsync'
import type { PanelDefinition } from '../panels'
import { usePlayer } from './usePlayer'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const me = session.userId ?? ''
const tracks = useResource(fetchTracks, [] as Track[], ['tracks'])
const playlists = useResource(fetchPlaylists, [] as Playlist[], ['playlists'])
const listening = useResource(() => fetchListeningState(), { consent: { me: false, partner: false }, session: null } as ListeningState, ['listening_sessions', 'listening_consent'])
const player = usePlayer({ tracks: tracks.data, listening: listening.data, myUserId: me })

const view = ref<'library' | 'playlists' | 'add'>('library')
const openPlaylistId = ref<string | null>(null)
const coverUrls = computed(() => Object.fromEntries(tracks.data.value.filter((t) => t.coverFileId).map((t) => [t.id, fileUrl(t.coverFileId!)])))

const openPlaylist = computed(() => playlists.data.value.find((p) => p.id === openPlaylistId.value) ?? null)
const playlistTracks = computed(() => (openPlaylist.value ? openPlaylist.value.trackIds.map((id) => tracks.data.value.find((t) => t.id === id)).filter((t): t is Track => !!t) : []))
const mineOpen = computed(() => openPlaylist.value?.ownerId === me)
const progress = computed(() => (player.durationMs.value > 0 ? Math.min(100, (player.positionMs.value / player.durationMs.value) * 100) : 0))

const consent = useAction(async (value: boolean) => {
  await setListeningConsent(value)
  await listening.reload()
})

// ---------------------------------------------------------------- add a track
const trackForm = ref({ title: '', artist: '' })
const audioFile = ref<File | null>(null)
const coverFile = ref<File | null>(null)

function onAudio(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  audioFile.value = file
  if (file && !trackForm.value.title) trackForm.value.title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
}
function onCover(event: Event): void {
  coverFile.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const probe = new Audio()
    const url = URL.createObjectURL(file)
    const done = (value: number | null) => { URL.revokeObjectURL(url); resolve(value) }
    probe.addEventListener('loadedmetadata', () => done(Number.isFinite(probe.duration) ? Math.round(probe.duration * 1000) : null), { once: true })
    probe.addEventListener('error', () => done(null), { once: true })
    probe.src = url
  })
}

const upload = useAction(async () => {
  if (!audioFile.value) throw Object.assign(new Error('Choose an audio file first.'), { name: 'ValidationError' })
  const cover = coverFile.value ? await downscaleImage(coverFile.value, 800) : null
  const durationMs = await probeDuration(audioFile.value)
  await addTrack({
    title: trackForm.value.title, artist: trackForm.value.artist, audio: audioFile.value,
    cover: cover ? new File([cover], 'cover', { type: cover.type }) : null, durationMs,
  })
  trackForm.value = { title: '', artist: '' }
  audioFile.value = coverFile.value = null
  view.value = 'library'
  await tracks.reload()
}, { success: 'Song added.' })

const removeTrack = useAction(async (track: Track) => {
  if (!window.confirm(`Remove “${track.title}” from your library?`)) return
  await deleteTrack(track.id)
  await tracks.reload()
})

// ---------------------------------------------------------------- playlists
const plName = ref('')
const plCover = ref<File | null>(null)
const createList = useAction(async () => {
  const cover = plCover.value ? await downscaleImage(plCover.value, 800) : null
  await createPlaylist(plName.value, cover ? new File([cover], 'cover', { type: cover.type }) : null)
  plName.value = ''
  plCover.value = null
  await playlists.reload()
}, { success: 'Playlist created.' })

const saveOrder = useAction(async (ids: string[]) => {
  if (!openPlaylist.value) return
  await setPlaylistTracks(openPlaylist.value.id, ids)
  await playlists.reload()
})
function move(index: number, delta: number): void {
  if (!openPlaylist.value) return
  const ids = [...openPlaylist.value.trackIds]
  const target = index + delta
  if (target < 0 || target >= ids.length) return
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  void saveOrder.run(ids)
}
function toggleInPlaylist(trackId: string): void {
  if (!openPlaylist.value) return
  const ids = openPlaylist.value.trackIds.includes(trackId) ? openPlaylist.value.trackIds.filter((id) => id !== trackId) : [...openPlaylist.value.trackIds, trackId]
  void saveOrder.run(ids)
}
const removeList = useAction(async (playlist: Playlist) => {
  if (!window.confirm(`Delete the playlist “${playlist.name}”?`)) return
  await deletePlaylist(playlist.id)
  openPlaylistId.value = null
  await playlists.reload()
})
const playList = (list: Playlist): void => {
  const ids = list.trackIds
  const first = ids[0]
  if (first) void player.playTrack(first, ids)
}
</script>

<template>
  <PanelShell :title="definition.title" :icon="definition.icon" @close="$emit('close')">
    <div class="stack">
      <section class="card stack player" aria-label="Player">
        <div class="player__top">
          <img v-if="player.coverUrl.value" class="cover" :src="player.coverUrl.value" alt="" width="64" height="64" />
          <div v-else class="cover cover--empty" aria-hidden="true">♪</div>
          <div class="grow">
            <p class="player__title">{{ player.current.value?.title ?? 'Nothing playing' }}</p>
            <p class="hint">{{ player.current.value?.artist || (player.current.value ? '' : 'Pick a song below') }}</p>
          </div>
        </div>
        <div class="seek">
          <label class="visually-hidden" for="seek">Seek</label>
          <input id="seek" type="range" min="0" :max="Math.max(1, Math.round(player.durationMs.value))" :value="Math.round(player.positionMs.value)" :disabled="!player.currentId.value" :style="{ '--p': `${progress}%` }" @change="player.seek(Number(($event.target as HTMLInputElement).value))" />
          <div class="seek__times"><span>{{ formatDuration(player.positionMs.value) }}</span><span>{{ formatDuration(player.durationMs.value) }}</span></div>
        </div>
        <div class="row controls">
          <button type="button" class="btn btn--small" aria-label="Previous song" @click="player.previous()">⏮</button>
          <button type="button" class="btn btn--primary" :aria-label="player.playing.value ? 'Pause' : 'Play'" :disabled="player.loading.value || tracks.data.value.length === 0" @click="player.toggle()">{{ player.playing.value ? '⏸ Pause' : '▶ Play' }}</button>
          <button type="button" class="btn btn--small" aria-label="Next song" @click="player.next()">⏭</button>
        </div>
        <button v-if="player.needsTap.value" type="button" class="btn btn--primary" @click="player.tryPlay()">Tap to join the music</button>
      </section>

      <section class="card stack" aria-labelledby="sync-h">
        <h3 id="sync-h">Listen together</h3>
        <label class="switch">
          <input type="checkbox" :checked="listening.data.value.consent.me" :disabled="consent.busy.value" @change="consent.run(($event.target as HTMLInputElement).checked)" />
          <span>I'd like to listen in sync with {{ partnerName }}</span>
        </label>
        <p class="hint" role="status">
          <template v-if="player.syncActive.value">You're both in. Play, pause and seeking are shared{{ player.iAmHost.value ? ' (you started this one)' : '' }}.</template>
          <template v-else-if="listening.data.value.consent.me">Waiting for {{ partnerName }} to opt in. Until then you listen on your own.</template>
          <template v-else>Off. Playback stays on your device only. Sync starts only when you both opt in, and either of you can stop it at any time.</template>
        </p>
      </section>

      <div class="row" role="tablist" aria-label="Music sections">
        <button v-for="v in (['library', 'playlists', 'add'] as const)" :key="v" type="button" role="tab" class="btn btn--small" :aria-selected="view === v" :class="{ 'is-active': view === v }" @click="view = v">{{ v === 'library' ? 'Songs' : v === 'playlists' ? 'Playlists' : 'Add a song' }}</button>
      </div>

      <ResourceView v-if="view === 'library'" :loading="tracks.loading.value" :error="tracks.error.value" @retry="tracks.reload">
        <EmptyState v-if="tracks.data.value.length === 0" emoji="🎶" title="No songs yet" hint="Add songs you own — your own recordings, music you bought, or files you have the right to use." />
        <ul v-else class="plain" role="list">
          <li v-for="track in tracks.data.value" :key="track.id" class="card track" :class="{ 'track--now': track.id === player.currentId.value }">
            <img v-if="coverUrls[track.id]" class="cover cover--small" :src="coverUrls[track.id]" alt="" width="44" height="44" />
            <div v-else class="cover cover--small cover--empty" aria-hidden="true">♪</div>
            <button type="button" class="track__play grow" :aria-label="`Play ${track.title}${track.artist ? ' by ' + track.artist : ''}`" @click="player.playTrack(track.id, tracks.data.value.map((t) => t.id))">
              <span class="track__title">{{ track.title }}</span><span class="hint">{{ track.artist }} {{ track.durationMs ? '· ' + formatDuration(track.durationMs) : '' }}</span>
            </button>
            <button v-if="track.ownerId === me" type="button" class="btn btn--small btn--quiet" :aria-label="`Remove ${track.title}`" @click="removeTrack.run(track)">🗑</button>
          </li>
        </ul>
      </ResourceView>

      <section v-else-if="view === 'playlists'" class="stack">
        <ResourceView :loading="playlists.loading.value" :error="playlists.error.value" @retry="playlists.reload">
          <template v-if="!openPlaylist">
            <EmptyState v-if="playlists.data.value.length === 0" emoji="📻" title="No playlists yet" />
            <ul class="plain" role="list">
              <li v-for="list in playlists.data.value" :key="list.id"><button type="button" class="btn grow wide" @click="openPlaylistId = list.id">{{ list.name }} <span class="hint">· {{ list.trackIds.length }} songs{{ list.ownerId !== me ? ` · by ${partnerName}` : '' }}</span></button></li>
            </ul>
            <form class="card stack" @submit.prevent="createList.run()">
              <h4>New playlist</h4>
              <div class="field"><label for="pl-name">Name</label><input id="pl-name" v-model="plName" class="input" maxlength="60" required /></div>
              <div class="field"><label for="pl-cover">Cover art (optional)</label><input id="pl-cover" type="file" accept="image/jpeg,image/png,image/webp" @change="plCover = ($event.target as HTMLInputElement).files?.[0] ?? null" /></div>
              <button type="submit" class="btn btn--small" :disabled="createList.busy.value">Create</button>
            </form>
          </template>
          <template v-else>
            <div class="row"><button type="button" class="btn btn--small btn--quiet" @click="openPlaylistId = null">← Playlists</button><button type="button" class="btn btn--small btn--primary" :disabled="playlistTracks.length === 0" @click="playList(openPlaylist)">▶ Play all</button><button v-if="mineOpen" type="button" class="btn btn--small btn--danger" @click="removeList.run(openPlaylist)">Delete</button></div>
            <h4>{{ openPlaylist.name }}</h4>
            <EmptyState v-if="playlistTracks.length === 0" title="Empty playlist" :hint="mineOpen ? 'Tick songs below to add them.' : undefined" />
            <ol class="plain" role="list">
              <li v-for="(track, index) in playlistTracks" :key="track.id" class="card track">
                <span class="grow">{{ index + 1 }}. {{ track.title }}</span>
                <template v-if="mineOpen">
                  <button type="button" class="btn btn--small btn--quiet" :aria-label="`Move ${track.title} up`" :disabled="index === 0" @click="move(index, -1)">↑</button>
                  <button type="button" class="btn btn--small btn--quiet" :aria-label="`Move ${track.title} down`" :disabled="index === playlistTracks.length - 1" @click="move(index, 1)">↓</button>
                </template>
              </li>
            </ol>
            <fieldset v-if="mineOpen" class="adder"><legend>Songs in this playlist</legend>
              <label v-for="track in tracks.data.value" :key="track.id" class="switch"><input type="checkbox" :checked="openPlaylist.trackIds.includes(track.id)" @change="toggleInPlaylist(track.id)" /><span>{{ track.title }}</span></label>
            </fieldset>
          </template>
        </ResourceView>
      </section>

      <form v-else class="stack" @submit.prevent="upload.run()">
        <p class="hint">Songs are stored privately on your server and streamed only to the two of you. Add music you own or have the right to use.</p>
        <div class="field"><label for="audio-file">Audio file</label><input id="audio-file" type="file" accept="audio/*" required @change="onAudio" /></div>
        <div class="field"><label for="track-title">Title</label><input id="track-title" v-model="trackForm.title" class="input" maxlength="120" required /></div>
        <div class="field"><label for="track-artist">Artist (optional)</label><input id="track-artist" v-model="trackForm.artist" class="input" maxlength="120" /></div>
        <div class="field"><label for="track-cover">Cover art (optional)</label><input id="track-cover" type="file" accept="image/jpeg,image/png,image/webp" @change="onCover" /></div>
        <button type="submit" class="btn btn--primary" :disabled="upload.busy.value">{{ upload.busy.value ? 'Uploading…' : 'Add song' }}</button>
      </form>
    </div>
  </PanelShell>
</template>

<style scoped>
.grow { flex: 1; min-width: 0; }
.wide { width: 100%; justify-content: flex-start; }
.plain { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
.player__top { display: flex; gap: var(--space-3); align-items: center; }
.player__title { margin: 0; font-weight: 800; overflow-wrap: anywhere; }
.cover { width: 64px; height: 64px; border-radius: var(--radius-sm); object-fit: cover; background: var(--surface-glass-strong); flex: none; }
.cover--empty { display: grid; place-items: center; font-size: 1.6rem; color: var(--color-gold); }
.cover--small { width: 44px; height: 44px; font-size: 1.1rem; }
.controls { justify-content: center; }
.seek input { width: 100%; accent-color: var(--color-gold); }
.seek__times { display: flex; justify-content: space-between; font-size: var(--text-xs); color: var(--color-ink-faint); }
.track { display: flex; gap: var(--space-2); align-items: center; padding: var(--space-2); }
.track--now { border-color: var(--color-gold); }
.track__play { display: grid; text-align: left; background: none; border: 0; padding: var(--space-2); min-height: var(--tap-target); }
.track__title { font-weight: 700; overflow-wrap: anywhere; }
.switch { display: flex; gap: var(--space-3); align-items: center; min-height: var(--tap-target); font-size: var(--text-sm); }
.switch input { width: 22px; height: 22px; accent-color: var(--color-gold); flex: none; }
.adder { border: 1px solid var(--line-soft); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); margin: 0; }
h3, h4 { margin-top: var(--space-1); }
</style>
