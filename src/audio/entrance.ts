import { reactive } from 'vue'

/**
 * Entrance album: an optional SoundCloud link that starts playing when somebody comes in.
 *
 * This is the ONE feature that talks to the internet, and only if a link has been saved and switched on in Settings.
 * It works by showing SoundCloud's own player in a tiny hidden frame, so SoundCloud (not this app) sees the request and
 * may set its own cookies. Nothing about the home is ever sent to it.
 */

const HOSTS = new Set(['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com', 'on.soundcloud.com'])
const PLAYER = 'https://w.soundcloud.com/player/'

/** Accepts a soundcloud.com link (album/set, playlist or track) and returns it normalised, or null. */
export function parseSoundCloudUrl(text: string): string | null {
  let url: URL
  const trimmed = text.trim()
  try {
    // "soundcloud.com/artist/sets/album" (pasted without the https://) is fine; any other scheme is refused below.
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password || url.port) return null
  if (!HOSTS.has(url.hostname.toLowerCase())) return null
  if (url.pathname.replace(/\//g, '').length < 2) return null // the bare homepage is not an album
  return `https://${url.hostname.toLowerCase()}${url.pathname}${url.search}`
}

export function embedUrlFor(soundCloudUrl: string): string {
  const parameters = new URLSearchParams({
    url: soundCloudUrl, auto_play: 'true', hide_related: 'true', show_comments: 'false', show_user: 'true', show_reposts: 'false', show_teaser: 'false', visual: 'false',
  })
  return `${PLAYER}?${parameters.toString()}`
}

export const entrance = reactive<{ active: boolean; playing: boolean }>({ active: false, playing: false })

let frame: HTMLIFrameElement | null = null

function command(method: string, value?: number): void {
  frame?.contentWindow?.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), 'https://w.soundcloud.com')
}

/**
 * Must be called from a click or tap: browsers only let a page start sound after the person has interacted with it.
 * Returns false when the link is not an acceptable SoundCloud link (nothing is loaded in that case).
 */
export function startEntranceMusic(link: string, volume: number): boolean {
  stopEntranceMusic()
  const url = parseSoundCloudUrl(link)
  if (!url) return false
  frame = document.createElement('iframe')
  frame.src = embedUrlFor(url)
  frame.title = 'Entrance album (SoundCloud)'
  frame.setAttribute('allow', 'autoplay')
  frame.setAttribute('referrerpolicy', 'no-referrer')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  // Kept in the page at 1px (not display:none), because browsers throttle or block media in frames that are hidden entirely.
  Object.assign(frame.style, { position: 'fixed', left: '0', bottom: '0', width: '1px', height: '1px', border: '0', opacity: '0', pointerEvents: 'none' })
  document.body.appendChild(frame)
  frame.addEventListener('load', () => command('setVolume', Math.round(volume * 100)), { once: true })
  entrance.active = true
  entrance.playing = true
  return true
}

export function setEntranceVolume(volume: number): void {
  if (entrance.active) command('setVolume', Math.round(Math.min(1, Math.max(0, volume)) * 100))
}

export function pauseEntranceMusic(): void {
  if (!entrance.active) return
  command('pause')
  entrance.playing = false
}

export function resumeEntranceMusic(): void {
  if (!entrance.active) return
  command('play')
  entrance.playing = true
}

export function stopEntranceMusic(): void {
  frame?.remove()
  frame = null
  entrance.active = false
  entrance.playing = false
}
