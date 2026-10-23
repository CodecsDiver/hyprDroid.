/** Voice-note recorder with a hard length cap and guaranteed microphone release. */

export const MAX_VOICE_SECONDS = 180

export function recordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export class VoiceRecorder {
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private finish: ((blob: Blob) => void) | null = null
  startedAt = 0

  async start(onAutoStop?: () => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    const mimeType = pickMime()
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined)
    this.chunks = []
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data)
    }
    this.recorder.onstop = () => {
      const type = (this.recorder?.mimeType || mimeType || 'audio/webm').split(';')[0]!
      this.release()
      this.finish?.(new Blob(this.chunks, { type }))
      this.finish = null
    }
    this.recorder.start()
    this.startedAt = Date.now()
    this.timer = setTimeout(() => {
      onAutoStop?.()
      void this.stop()
    }, MAX_VOICE_SECONDS * 1000)
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.recorder || this.recorder.state === 'inactive') return reject(new Error('Not recording'))
      this.finish = resolve
      this.recorder.stop()
    })
  }

  /** Always call when leaving the screen: turns the microphone indicator off. */
  cancel(): void {
    this.finish = null
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop()
    this.release()
  }

  private release(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
  }
}
