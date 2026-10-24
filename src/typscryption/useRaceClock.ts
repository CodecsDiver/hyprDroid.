import { computed, onBeforeUnmount, ref } from 'vue'

/** A stopwatch for one round. Penalties (wrong picks, mistyped characters) are added on top of the real time. */
export function useRaceClock() {
  const startedAt = ref(0)
  const now = ref(0)
  const isRunning = ref(false)
  const penaltyMs = ref(0)
  const frozenMs = ref(0)
  let timer: ReturnType<typeof setInterval> | undefined

  const elapsedMs = computed(() => (isRunning.value ? Math.max(0, now.value - startedAt.value) + penaltyMs.value : frozenMs.value))
  const elapsedSeconds = computed(() => elapsedMs.value / 1000)

  function start(): void {
    penaltyMs.value = 0
    frozenMs.value = 0
    startedAt.value = performance.now()
    now.value = startedAt.value
    isRunning.value = true
    clearInterval(timer)
    timer = setInterval(() => (now.value = performance.now()), 80)
  }

  /** Stops the clock and returns the final time in milliseconds, penalties included. */
  function stop(): number {
    if (isRunning.value) {
      now.value = performance.now()
      frozenMs.value = Math.max(0, now.value - startedAt.value) + penaltyMs.value
      isRunning.value = false
    }
    clearInterval(timer)
    return frozenMs.value
  }

  function reset(): void {
    clearInterval(timer)
    isRunning.value = false
    penaltyMs.value = 0
    frozenMs.value = 0
  }

  const addPenalty = (ms: number) => (penaltyMs.value += ms)

  onBeforeUnmount(() => clearInterval(timer))
  return { elapsedMs, elapsedSeconds, isRunning, penaltyMs, start, stop, reset, addPenalty }
}

export function formatSeconds(seconds: number): string {
  return `${Math.max(0, seconds).toFixed(1)}s`
}
