interface Particle {
  x: number
  y: number
  velocityX: number
  velocityY: number
  remainingLife: number
  totalLife: number
  hue: number
  size: number
}

export interface BurstOptions {
  count: number
  hues: number[]
  speed?: number
  spread?: number
  gravity?: number
  upwardBias?: number
  size?: number
}

export interface ParticleField {
  burst(x: number, y: number, options: BurstOptions): void
  ring(x: number, y: number, hue: number, radius: number): void
  resize(): void
  stop(): void
}

const MAX_PARTICLES = 900
export const HUE_GREEN = 145
export const HUE_CYAN = 188
export const HUE_VIOLET = 270
export const HUE_AMBER = 42

interface Ring {
  x: number
  y: number
  hue: number
  maxRadius: number
  age: number
}

/**
 * Additive 2D canvas particles. `getIntensity` is the animation scale (0 turns everything off),
 * and spawn counts scale with it so low settings stay cheap on integrated graphics.
 */
export function createParticleField(canvas: HTMLCanvasElement, getIntensity: () => number): ParticleField {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas is unavailable')
  const particles: Particle[] = []
  const rings: Ring[] = []
  let lastFrameMs = performance.now()
  let animationFrameId = 0
  let pixelRatio = 1

  function resize(): void {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(window.innerWidth * pixelRatio)
    canvas.height = Math.floor(window.innerHeight * pixelRatio)
  }

  function burst(x: number, y: number, options: BurstOptions): void {
    const intensity = getIntensity()
    const count = Math.round(options.count * intensity)
    const speed = options.speed ?? 320
    const spread = options.spread ?? Math.PI * 2
    const upwardBias = options.upwardBias ?? 0
    for (let index = 0; index < count && particles.length < MAX_PARTICLES; index++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread
      const magnitude = speed * (0.25 + Math.random() * 0.75)
      const life = 0.45 + Math.random() * 0.9
      particles.push({
        x,
        y,
        velocityX: Math.cos(angle) * magnitude,
        velocityY: Math.sin(angle) * magnitude - upwardBias,
        remainingLife: life,
        totalLife: life,
        hue: options.hues[Math.floor(Math.random() * options.hues.length)],
        size: (options.size ?? 3) * (0.6 + Math.random() * 0.9),
      })
    }
    if (!animationFrameId) animationFrameId = requestAnimationFrame(renderFrame)
  }

  function ring(x: number, y: number, hue: number, radius: number): void {
    if (getIntensity() <= 0) return
    rings.push({ x, y, hue, maxRadius: radius * Math.max(getIntensity(), 0.5), age: 0 })
    if (!animationFrameId) animationFrameId = requestAnimationFrame(renderFrame)
  }

  const gravityFor = (particle: Particle) => (particle.size > 4 ? 120 : 260)

  function renderFrame(nowMs: number): void {
    const deltaSeconds = Math.min((nowMs - lastFrameMs) / 1000, 0.05)
    lastFrameMs = nowMs
    context!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context!.clearRect(0, 0, canvas.width, canvas.height)
    context!.globalCompositeOperation = 'lighter'

    for (let index = particles.length - 1; index >= 0; index--) {
      const particle = particles[index]
      particle.remainingLife -= deltaSeconds
      if (particle.remainingLife <= 0) {
        particles.splice(index, 1)
        continue
      }
      particle.velocityY += gravityFor(particle) * deltaSeconds
      particle.velocityX *= 1 - 0.8 * deltaSeconds
      particle.x += particle.velocityX * deltaSeconds
      particle.y += particle.velocityY * deltaSeconds
      const lifeFraction = particle.remainingLife / particle.totalLife
      context!.globalAlpha = lifeFraction
      context!.fillStyle = `hsl(${particle.hue} 100% ${55 + 25 * lifeFraction}%)`
      const size = particle.size * (0.5 + lifeFraction)
      context!.fillRect(particle.x - size / 2, particle.y - size / 2, size, size)
    }

    for (let index = rings.length - 1; index >= 0; index--) {
      const shockwave = rings[index]
      shockwave.age += deltaSeconds
      const progress = shockwave.age / 0.8
      if (progress >= 1) {
        rings.splice(index, 1)
        continue
      }
      context!.globalAlpha = (1 - progress) * 0.9
      context!.lineWidth = 3 + (1 - progress) * 5
      context!.strokeStyle = `hsl(${shockwave.hue} 100% 65%)`
      context!.beginPath()
      context!.arc(shockwave.x, shockwave.y, shockwave.maxRadius * (1 - Math.pow(1 - progress, 3)), 0, Math.PI * 2)
      context!.stroke()
    }

    if (particles.length > 0 || rings.length > 0) {
      animationFrameId = requestAnimationFrame(renderFrame)
    } else {
      animationFrameId = 0
      context!.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  resize()
  return {
    burst,
    ring,
    resize,
    stop: () => {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = 0
    },
  }
}
