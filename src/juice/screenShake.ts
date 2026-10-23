/** Shakes the whole app root using the Web Animations API (transform only, compositor-friendly). */
export function shakeScreen(amplitudePx: number, durationMs: number): void {
  const root = document.getElementById('app')
  if (!root || amplitudePx <= 0) return
  const steps = 10
  const keyframes: Keyframe[] = []
  for (let step = 0; step <= steps; step++) {
    const decay = 1 - step / steps
    const x = step === steps ? 0 : (Math.random() * 2 - 1) * amplitudePx * decay
    const y = step === steps ? 0 : (Math.random() * 2 - 1) * amplitudePx * decay
    keyframes.push({ transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)` })
  }
  root.animate(keyframes, { duration: durationMs, easing: 'linear' })
}
