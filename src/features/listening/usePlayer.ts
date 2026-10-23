import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { sendListeningCommand, type ListeningState, type Track } from '@/data/repos/music'
import { signedUrl } from '@/data/storage'
import { expectedPositionMs, isSyncActive, planCorrection } from '@/domain/listeningSync'
import { serverNow } from '@/state/live'
import { prefs } from '@/state/prefs'
import { showToast } from '@/state/toasts'

export interface PlayerOptions {
  tracks: Ref<Track[]>
  listening: Ref<ListeningState>
  myUserId: string
}

/**
 * Audio playback for Listening Together.
 *
 * Local mode: independent playback of the household's tracks.
 * Synced mode (only while BOTH people have opted in): the database's
 * listening session is the source of truth. Controls send commands; every
 * device follows the session using the server clock, easing small drift with
 * a tiny playback-rate change and seeking on large drift.
 */
export function usePlayer({ tracks, listening, myUserId }: PlayerOptions) {
  const audio = new Audio()
  audio.preload = 'metadata'

  const currentId = ref<string | null>(null)
  const queue = ref<string[]>([])
  const playing = ref(false)
  const positionMs = ref(0)
  const durationMs = ref(0)
  const loading = ref(false)
  const needsTap = ref(false)
  const coverUrl = ref<string | null>(null)

  const current = computed(() => tracks.value.find((t) => t.id === currentId.value) ?? null)
  const syncActive = computed(() => isSyncActive(listening.value.consent))
  const iAmHost = computed(() => listening.value.session?.hostId === myUserId)

  audio.volume = prefs.volume
  const stopVolumeWatch = watch(() => prefs.volume, (v) => (audio.volume = v))

  audio.addEventListener('timeupdate', () => (positionMs.value = audio.currentTime * 1000))
  audio.addEventListener('durationchange', () => (durationMs.value = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0))
  audio.addEventListener('play', () => (playing.value = true))
  audio.addEventListener('pause', () => (playing.value = false))
  audio.addEventListener('ended', () => void onEnded())
  audio.addEventListener('error', () => {
    loading.value = false
    showToast('That song could not be played.', { tone: 'error' })
  })

  async function load(trackId: string, startAtMs = 0): Promise<void> {
    const track = tracks.value.find((t) => t.id === trackId)
    if (!track) return
    loading.value = true
    try {
      audio.src = await signedUrl('music', track.audioPath)
      currentId.value = trackId
      audio.currentTime = startAtMs / 1000
      coverUrl.value = track.coverPath ? await signedUrl('covers', track.coverPath).catch(() => null) : null
      updateMediaSession(track)
    } finally {
      loading.value = false
    }
  }

  async function tryPlay(): Promise<void> {
    try {
      await audio.play()
      needsTap.value = false
    } catch {
      needsTap.value = true // autoplay policy: needs a tap
    }
  }

  function updateMediaSession(track: Track): void {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist, ...(coverUrl.value ? { artwork: [{ src: coverUrl.value }] } : {}) })
    navigator.mediaSession.setActionHandler('play', () => void toggle())
    navigator.mediaSession.setActionHandler('pause', () => void toggle())
    navigator.mediaSession.setActionHandler('nexttrack', () => void next())
    navigator.mediaSession.setActionHandler('previoustrack', () => void previous())
  }

  // ------------------------------------------------------------- controls
  async function playTrack(trackId: string, newQueue?: string[]): Promise<void> {
    if (newQueue) queue.value = newQueue
    else if (!queue.value.includes(trackId)) queue.value = tracks.value.map((t) => t.id)
    await load(trackId)
    await tryPlay() // optimistic: start locally right away
    if (syncActive.value) await command('play', trackId, 0)
  }

  async function toggle(): Promise<void> {
    if (!currentId.value) {
      const first = queue.value[0] ?? tracks.value[0]?.id
      if (first) await playTrack(first)
      return
    }
    if (audio.paused) {
      await tryPlay()
      if (syncActive.value) await command('play', currentId.value, audio.currentTime * 1000)
    } else {
      audio.pause()
      if (syncActive.value) await command('pause', currentId.value, audio.currentTime * 1000)
    }
  }

  async function seek(ms: number): Promise<void> {
    audio.currentTime = Math.max(0, ms) / 1000
    positionMs.value = ms
    if (syncActive.value && currentId.value) await command('seek', currentId.value, ms)
  }

  async function step(direction: 1 | -1): Promise<void> {
    const order = queue.value.length > 0 ? queue.value : tracks.value.map((t) => t.id)
    if (order.length === 0) return
    const index = order.indexOf(currentId.value ?? '')
    const target = order[(index + direction + order.length) % order.length]
    if (target) await playTrack(target, order)
  }
  const next = (): Promise<void> => step(1)
  const previous = (): Promise<void> => (audio.currentTime > 3 ? seek(0) : step(-1))

  async function onEnded(): Promise<void> {
    // In a shared session only the host advances, so we do not both skip.
    if (syncActive.value && !iAmHost.value) return
    if (queue.value.length > 1) await next()
    else if (syncActive.value && currentId.value) await command('stop', null, 0)
  }

  async function command(action: 'play' | 'pause' | 'seek' | 'stop', trackId: string | null, ms: number): Promise<void> {
    try {
      await sendListeningCommand(action, { trackId, positionMs: ms })
    } catch (error) {
      showToast('Could not update the shared player. Listening locally for now.', { tone: 'warning' })
      console.warn('[listening]', error)
    }
  }

  // ------------------------------------------------------------- following the shared session
  async function applySession(): Promise<void> {
    const session = listening.value.session
    if (!syncActive.value || !session) return
    if (session.trackId && session.trackId !== currentId.value) {
      const expected = expectedPositionMs(session, serverNow())
      await load(session.trackId, session.state === 'playing' ? expected : session.positionMs)
    }
    if (session.state === 'playing') {
      const expected = expectedPositionMs(session, serverNow(), durationMs.value)
      const plan = planCorrection(audio.currentTime * 1000, expected)
      if (plan.action === 'seek') audio.currentTime = plan.targetMs / 1000
      if (audio.paused) await tryPlay()
    } else if (session.state === 'paused') {
      if (!audio.paused) audio.pause()
      audio.currentTime = session.positionMs / 1000
    } else if (!audio.paused) {
      audio.pause()
    }
  }

  watch(() => [listening.value.session?.revision, syncActive.value], () => void applySession(), { immediate: true })

  const driftTimer = setInterval(() => {
    const session = listening.value.session
    if (!syncActive.value || !session || session.state !== 'playing' || audio.paused) {
      if (audio.playbackRate !== 1) audio.playbackRate = 1
      return
    }
    const plan = planCorrection(audio.currentTime * 1000, expectedPositionMs(session, serverNow(), durationMs.value))
    if (plan.action === 'seek') audio.currentTime = plan.targetMs / 1000
    audio.playbackRate = plan.playbackRate
  }, 2000)

  onScopeDispose(() => {
    clearInterval(driftTimer)
    stopVolumeWatch()
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null
      for (const action of ['play', 'pause', 'nexttrack', 'previoustrack'] as const) navigator.mediaSession.setActionHandler(action, null)
    }
  })

  return { current, currentId, queue, playing, positionMs, durationMs, loading, needsTap, coverUrl, syncActive, iAmHost, playTrack, toggle, seek, next, previous, tryPlay }
}
