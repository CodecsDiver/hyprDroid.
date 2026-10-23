import { Color, DirectionalLight, Group, HemisphereLight, PointLight } from 'three'
import type { EnvironmentState, TimeOfDay } from '@/domain/environment'

const HEMI_BY_TIME: Record<TimeOfDay, { sky: number; ground: number; intensity: number }> = {
  dawn: { sky: 0xffd9c0, ground: 0x3a1c36, intensity: 1.9 },
  day: { sky: 0xffe6c7, ground: 0x2a1630, intensity: 2.2 },
  dusk: { sky: 0xffb48a, ground: 0x2a1233, intensity: 1.7 },
  night: { sky: 0x8a8fd8, ground: 0x160a28, intensity: 1.15 },
}

/** Lights that smoothly follow the derived environment state. */
export class LightingRig {
  readonly group = new Group()
  private readonly hemisphere = new HemisphereLight(0xffe6c7, 0x2a1630, 2.2)
  private readonly sun = new DirectionalLight(0xffffff, 2.1)
  private readonly lamp = new PointLight(0xffcc8d, 0, 3.6, 2)
  private readonly roseGlow = new PointLight(0xff9fc0, 0, 2.2, 2)

  private readonly goal = { hemi: new Color(), ground: new Color(), hemiIntensity: 2.2, sun: new Color(), sunIntensity: 2.1, lamp: new Color(), lampIntensity: 0, roseIntensity: 0 }

  constructor() {
    this.sun.position.set(4, 5, 3)
    this.lamp.position.set(0, 1.95, -0.05)
    this.roseGlow.position.set(1.55, 1.2, 0.7)
    this.group.add(this.hemisphere, this.sun, this.lamp, this.roseGlow)
  }

  setLampPosition(x: number, y: number, z: number): void {
    this.lamp.position.set(x, y, z)
  }

  apply(env: EnvironmentState): void {
    const base = HEMI_BY_TIME[env.timeOfDay]
    this.goal.hemi.set(base.sky)
    this.goal.ground.set(base.ground)
    const rainy = env.weather === 'rain'
    this.goal.hemiIntensity = base.intensity * (rainy ? 0.8 : 1)
    this.goal.sun.set(env.window.color)
    this.goal.sunIntensity = env.window.intensity * 1.4
    this.goal.lamp.set(env.lamp.color)
    this.goal.lampIntensity = env.lamp.intensity
    this.goal.roseIntensity = env.weather === 'hearts' || env.weather === 'sunrise' ? 1.4 : env.weather === 'candle' ? 0.8 : 0
    if (env.weather === 'hearts') this.goal.roseIntensity = 1.6
  }

  /** Returns true while still converging. */
  update(delta: number): boolean {
    const k = 1 - Math.exp(-delta * 3)
    const g = this.goal
    this.hemisphere.color.lerp(g.hemi, k)
    this.hemisphere.groundColor.lerp(g.ground, k)
    this.sun.color.lerp(g.sun, k)
    this.lamp.color.lerp(g.lamp, k)
    const before = this.hemisphere.intensity + this.sun.intensity + this.lamp.intensity + this.roseGlow.intensity
    this.hemisphere.intensity += (g.hemiIntensity - this.hemisphere.intensity) * k
    this.sun.intensity += (g.sunIntensity - this.sun.intensity) * k
    this.lamp.intensity += (g.lampIntensity - this.lamp.intensity) * k
    this.roseGlow.intensity += (g.roseIntensity - this.roseGlow.intensity) * k
    const after = this.hemisphere.intensity + this.sun.intensity + this.lamp.intensity + this.roseGlow.intensity
    return Math.abs(after - before) > 0.0005
  }

  get lampIntensity(): number {
    return this.lamp.intensity
  }

  dispose(): void {
    this.hemisphere.dispose()
    this.sun.dispose()
    this.lamp.dispose()
    this.roseGlow.dispose()
    this.group.clear()
  }
}
