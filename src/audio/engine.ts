import { watch } from 'vue'
import { DEFAULT_MANIFEST, type AssetManifest, type AssetResolver, type SfxId } from '@/assets/manifest'
import type { AmbientId } from '@/domain/environment'
import { prefs } from '@/state/prefs'
import { Synth } from './synth'

const synth = new Synth()
let manifest: AssetManifest = DEFAULT_MANIFEST
let resolver: AssetResolver | null = null

const sampleCache = new Map<string, Promise<string | null>>()

export function configureAudio(next: { manifest: AssetManifest; resolver: AssetResolver }): void {
  manifest = next.manifest
  resolver = next.resolver
  sampleCache.clear()
}

function syncSynth(): void {
  synth.enabled = prefs.soundOn
  synth.volume = prefs.volume
}
watch(() => [prefs.soundOn, prefs.volume], syncSynth, { immediate: true })

/** Browsers only allow audio after a gesture; call from any pointer/key handler. */
export function unlockAudio(): void {
  synth.unlock()
}

const FALLBACK: Record<SfxId, () => void> = {
  ui: () => synth.softBlip(), nav: () => synth.tick(), open: () => synth.open(), close: () => synth.close(), select: () => synth.softBlip(),
  confirm: () => synth.sparkleArpeggio(), love: () => { synth.tinyKiss(); synth.sparkleArpeggio() }, pop: () => synth.bubblePops(),
  guitar: () => synth.pluck(), glass: () => synth.glass(), rose: () => synth.bong(), zoom: () => synth.tick(), rotate: () => synth.tick(),
  snap: () => synth.toggle(), toggle: () => synth.toggle(), stage: () => synth.sparkleArpeggio(),
}

function sample(id: SfxId): Promise<string | null> {
  const asset = manifest.sfx[id]
  if (!asset?.source || !resolver) return Promise.resolve(null)
  let pending = sampleCache.get(id)
  if (!pending) {
    pending = resolver.url(asset.source).catch(() => null)
    sampleCache.set(id, pending)
  }
  return pending
}

/** Plays a manifest sample if one is provided, otherwise the synthesised fallback. */
export function playSfx(id: string): void {
  if (!prefs.soundOn) return
  const sfx = (id in FALLBACK ? id : 'ui') as SfxId
  void sample(sfx).then((url) => {
    if (!url) return FALLBACK[sfx]()
    const audio = new Audio(url)
    audio.volume = Math.min(1, (manifest.sfx[sfx]?.volume ?? 0.3) * prefs.volume)
    audio.play().catch(() => FALLBACK[sfx]())
  })
}

export const cues = {
  bubblePops: () => synth.bubblePops(),
  softBlip: () => synth.softBlip(),
  sparkleArpeggio: () => synth.sparkleArpeggio(),
  tinyKiss: () => synth.tinyKiss(),
  chimeSweep: () => synth.chimeSweep(),
  hugSpin: () => synth.hugSpin(),
  shootingStar: () => synth.shootingStarWhoosh(),
  stickerSqueak: () => synth.stickerSqueak(),
  kawaiiNote: () => synth.kawaiiNote(),
}

/**
 * Mood loops. Exactly one plays at a time with a short cross-fade. When the
 * manifest provides no file for a loop, nothing plays (we do not fake it).
 */
export class AmbientPlayer {
  private audio: HTMLAudioElement | null = null
  private current: AmbientId | null = null
  private fadeTimer: ReturnType<typeof setInterval> | null = null

  async set(id: AmbientId | null): Promise<void> {
    if (id === this.current) return
    this.current = id
    this.fadeOut(this.audio)
    this.audio = null
    if (!id || !prefs.soundOn || !resolver) return
    const asset = manifest.music.ambient[id]
    const url = await resolver.url(asset.source).catch(() => null)
    if (!url || this.current !== id) return
    const audio = new Audio(url)
    audio.loop = true
    audio.volume = 0
    this.audio = audio
    try {
      await audio.play()
      this.fadeTo(audio, asset.volume * prefs.volume)
    } catch {
      /* autoplay blocked until the next gesture: retry via refresh() */
    }
  }

  /** Re-attempts playback after a user gesture or a volume/mute change. */
  refresh(): void {
    const id = this.current
    this.current = null
    void this.set(prefs.soundOn ? id : null)
  }

  private fadeTo(audio: HTMLAudioElement, target: number): void {
    if (this.fadeTimer) clearInterval(this.fadeTimer)
    this.fadeTimer = setInterval(() => {
      audio.volume = Math.min(target, audio.volume + target / 12)
      if (audio.volume >= target - 0.001 && this.fadeTimer) clearInterval(this.fadeTimer)
    }, 60)
  }

  private fadeOut(audio: HTMLAudioElement | null): void {
    if (!audio) return
    const timer = setInterval(() => {
      audio.volume = Math.max(0, audio.volume - 0.08)
      if (audio.volume <= 0.001) {
        audio.pause()
        clearInterval(timer)
      }
    }, 60)
  }

  dispose(): void {
    if (this.fadeTimer) clearInterval(this.fadeTimer)
    this.fadeOut(this.audio)
    this.audio = null
    this.current = null
  }
}
