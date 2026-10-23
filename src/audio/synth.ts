/**
 * Synthesised sound effects, ported from the original Love Universe / Signal
 * Home (same oscillator recipes). They are the default for every sound effect
 * until a real sample is supplied in the asset manifest.
 */

export class Synth {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  volume = 0.8
  enabled = true

  /** Must be called from a user gesture at least once before sound can play. */
  unlock(): void {
    if (!this.context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.context = new Ctor()
      this.master = this.context.createGain()
      this.master.connect(this.context.destination)
    }
    if (this.context.state === 'suspended') void this.context.resume()
  }

  private ready(): { ctx: AudioContext; out: GainNode } | null {
    if (!this.enabled || !this.context || !this.master) return null
    this.master.gain.value = this.volume
    return { ctx: this.context, out: this.master }
  }

  private tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.02, endFreq?: number): void {
    const r = this.ready()
    if (!r) return
    const osc = r.ctx.createOscillator()
    const gain = r.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq ?? freq * 0.88), start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(gain)
    gain.connect(r.out)
    osc.start(start)
    osc.stop(start + duration + 0.04)
  }

  private noise(start: number, duration = 0.09, volume = 0.012, lowpass = 2000): void {
    const r = this.ready()
    if (!r) return
    const buffer = r.ctx.createBuffer(1, Math.max(1, Math.floor(r.ctx.sampleRate * duration)), r.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const source = r.ctx.createBufferSource()
    source.buffer = buffer
    const filter = r.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(lowpass, start)
    const gain = r.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(r.out)
    source.start(start)
    source.stop(start + duration + 0.02)
  }

  private now(): number {
    return this.context?.currentTime ?? 0
  }

  // ---- Love Universe cues (verbatim recipes) ----
  bubblePops(): void {
    const t = this.now()
    ;[0, 0.04, 0.08].forEach((offset, i) => {
      this.tone(720 + Math.random() * 90, t + offset, 0.09, 'sine', 0.035, 210 + Math.random() * 60)
      this.tone(1040 + Math.random() * 120, t + offset + 0.018, 0.08, 'triangle', 0.018, 680)
      this.noise(t + offset, 0.05, 0.005 + i * 0.0015, 1800)
    })
  }
  softBlip(): void {
    const t = this.now()
    this.tone(880, t, 0.08, 'sine', 0.024, 720)
    this.tone(1240, t + 0.045, 0.09, 'triangle', 0.016, 980)
  }
  sparkleArpeggio(): void {
    const t = this.now()
    ;[1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, t + i * 0.042, 0.17, 'triangle', 0.016, f * 0.92))
  }
  tinyKiss(): void {
    const t = this.now()
    this.tone(980, t, 0.07, 'sine', 0.018, 730)
    this.tone(1460, t + 0.05, 0.09, 'triangle', 0.013, 1120)
    this.noise(t + 0.015, 0.025, 0.0024, 2500)
  }
  chimeSweep(): void {
    const t = this.now()
    ;[784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, t + i * 0.05, 0.22, i % 2 ? 'triangle' : 'sine', 0.013, f * 1.03))
  }
  hugSpin(): void {
    const t = this.now()
    ;[660, 820, 980, 1320, 980, 880].forEach((f, i) => this.tone(f, t + i * 0.05, 0.12, i % 2 ? 'triangle' : 'sine', 0.016, f * 0.94))
    this.noise(t + 0.07, 0.07, 0.003, 1600)
  }
  starShimmer(): void {
    const t = this.now()
    ;[1480, 1760, 2093].forEach((f, i) => this.tone(f, t + i * 0.038, 0.12, 'triangle', 0.01, f * 0.95))
  }
  shootingStarWhoosh(): void {
    const t = this.now()
    this.noise(t, 0.22, 0.004, 900)
    this.tone(620, t, 0.2, 'sine', 0.008, 320)
    setTimeout(() => this.starShimmer(), 110)
  }
  stickerSqueak(): void {
    const t = this.now()
    this.tone(560, t, 0.06, 'square', 0.006, 420)
    this.tone(930, t + 0.03, 0.08, 'sine', 0.014, 780)
  }
  // ---- Signal Home cues ----
  kawaiiNote(): void {
    const t = this.now()
    ;[740, 932, 1175].forEach((f, i) => this.tone(f, t + i * 0.075, 0.2, 'sine', 0.05, f))
  }
  // ---- new, in the same style ----
  pluck(): void {
    const t = this.now()
    this.tone(196, t, 0.45, 'triangle', 0.05, 190)
    this.tone(392, t, 0.3, 'sine', 0.02, 380)
  }
  bong(): void {
    const t = this.now()
    this.tone(220, t, 0.7, 'sine', 0.05, 215)
    this.tone(440, t, 0.5, 'sine', 0.015, 430)
  }
  glass(): void {
    const t = this.now()
    ;[1568, 2349].forEach((f, i) => this.tone(f, t + i * 0.03, 0.4, 'sine', 0.012, f * 0.99))
  }
  tick(): void {
    this.tone(1400, this.now(), 0.03, 'square', 0.005, 1200)
  }
  toggle(): void {
    const t = this.now()
    this.tone(520, t, 0.05, 'square', 0.008, 480)
    this.tone(780, t + 0.05, 0.06, 'square', 0.008, 700)
  }
  open(): void {
    const t = this.now()
    this.tone(660, t, 0.08, 'sine', 0.02, 880)
  }
  close(): void {
    const t = this.now()
    this.tone(880, t, 0.08, 'sine', 0.02, 660)
  }
}
