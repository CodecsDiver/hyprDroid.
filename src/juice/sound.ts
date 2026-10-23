import { describeLevelUp } from '../gamification/levelUpTier'
import { onJuice, type JuiceEvent } from './juiceBus'

/** Pentatonic ladder (Hz) so rapid typing sounds like a melody instead of noise. */
const KEYSTROKE_SCALE = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5]

let audioContext: AudioContext | null = null

function context(): AudioContext | null {
  try {
    audioContext ??= new AudioContext()
    if (audioContext.state === 'suspended') void audioContext.resume()
    return audioContext
  } catch {
    return null
  }
}

function tone(
  frequency: number,
  startOffset: number,
  duration: number,
  options: { type?: OscillatorType; volume?: number; slideTo?: number } = {},
): void {
  const ctx = context()
  if (!ctx) return
  const start = ctx.currentTime + startOffset
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = options.type ?? 'triangle'
  oscillator.frequency.setValueAtTime(frequency, start)
  if (options.slideTo) oscillator.frequency.exponentialRampToValueAtTime(options.slideTo, start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.08, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

function arpeggio(frequencies: number[], gap: number, duration: number, volume: number, type: OscillatorType = 'triangle'): void {
  frequencies.forEach((frequency, index) => tone(frequency, index * gap, duration, { volume, type }))
}

function play(event: JuiceEvent): void {
  switch (event.kind) {
    case 'keystroke':
      tone(KEYSTROKE_SCALE[event.combo % KEYSTROKE_SCALE.length], 0, 0.07, { volume: 0.035, type: 'sine' })
      break
    case 'combo-milestone':
      arpeggio([523.25, 659.25, 783.99, 1046.5], 0.05, 0.16, 0.07)
      break
    case 'combo-broken':
      tone(220, 0, 0.35, { type: 'sawtooth', volume: 0.05, slideTo: 70 })
      break
    case 'saved':
      arpeggio([659.25, 987.77], 0.08, 0.2, 0.08, 'sine')
      break
    case 'run-started':
      tone(220, 0, 0.18, { type: 'square', volume: 0.04, slideTo: 440 })
      break
    case 'objective-met':
      arpeggio([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.07, 0.24, 0.09)
      break
    case 'objective-failed':
      tone(180, 0, 0.28, { type: 'sawtooth', volume: 0.05, slideTo: 110 })
      break
    case 'quest-completed':
    case 'achievement-unlocked':
      arpeggio([783.99, 987.77, 1174.66, 1567.98], 0.09, 0.3, 0.08, 'sine')
      break
    case 'level-up': {
      const style = describeLevelUp(event.level, event.rankChanged)
      const ladder = [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093, 2637, 3136]
      const notes = ladder.slice(0, Math.min(ladder.length, 5 + style.ringCount))
      arpeggio(notes, 0.075, 0.5, 0.1)
      if (style.tier === 'rank' || style.tier === 'milestone' || style.tier === 'legend') {
        arpeggio(notes.map((note) => note * 1.5), 0.075, 0.45, 0.06, 'sine')
      }
      tone(130.81, 0, 1.2 + style.ringCount * 0.2, { type: 'sawtooth', volume: 0.06 + style.ringCount * 0.005, slideTo: 261.63 })
      break
    }
    case 'project-completed':
      arpeggio([392, 523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093], 0.09, 0.55, 0.1)
      break
    case 'xp-gained':
      break
  }
}

/** Subscribes the synth to the juice bus; `isEnabled` is read on every event. */
export function startSoundEngine(isEnabled: () => boolean): () => void {
  return onJuice((event) => {
    if (isEnabled()) play(event)
  })
}
