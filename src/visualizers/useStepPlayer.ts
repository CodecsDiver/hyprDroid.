import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'

export interface StepPlayer<TFrame> {
  frame: ComputedRef<TFrame>
  frameIndex: Ref<number>
  frameCount: ComputedRef<number>
  isPlaying: Ref<boolean>
  isAtEnd: ComputedRef<boolean>
  stepDelayMs: Ref<number>
  play(): void
  pause(): void
  togglePlay(): void
  stepForward(): void
  stepBack(): void
  restart(): void
}

/**
 * Plays a precomputed list of frames. When the frame list changes the player rewinds.
 * `onReachedEnd` fires every time playback or stepping lands on the last frame.
 */
export function useStepPlayer<TFrame>(
  getFrames: () => TFrame[],
  onReachedEnd?: () => void,
): StepPlayer<TFrame> {
  const frameIndex = ref(0)
  const isPlaying = ref(false)
  const stepDelayMs = ref(220)
  let timer: ReturnType<typeof setTimeout> | undefined

  const frames = computed(() => getFrames())
  const frameCount = computed(() => frames.value.length)
  const frame = computed(() => frames.value[Math.min(frameIndex.value, frames.value.length - 1)])
  const isAtEnd = computed(() => frameIndex.value >= frames.value.length - 1)

  function clearTimer(): void {
    clearTimeout(timer)
    timer = undefined
  }

  function advance(): void {
    if (isAtEnd.value) {
      isPlaying.value = false
      return
    }
    frameIndex.value++
    if (isAtEnd.value) {
      isPlaying.value = false
      onReachedEnd?.()
      return
    }
    timer = setTimeout(advance, stepDelayMs.value)
  }

  function play(): void {
    if (isAtEnd.value) frameIndex.value = 0
    isPlaying.value = true
    clearTimer()
    timer = setTimeout(advance, stepDelayMs.value)
  }

  function pause(): void {
    isPlaying.value = false
    clearTimer()
  }

  function stepForward(): void {
    pause()
    if (!isAtEnd.value) frameIndex.value++
    if (isAtEnd.value) onReachedEnd?.()
  }

  function stepBack(): void {
    pause()
    if (frameIndex.value > 0) frameIndex.value--
  }

  function restart(): void {
    pause()
    frameIndex.value = 0
  }

  watch(frames, restart)
  onBeforeUnmount(clearTimer)

  return {
    frame, frameIndex, frameCount, isPlaying, isAtEnd, stepDelayMs,
    play, pause, togglePlay: () => (isPlaying.value ? pause() : play()), stepForward, stepBack, restart,
  }
}
