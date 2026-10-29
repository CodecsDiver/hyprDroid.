import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, LineBasicMaterial, LineSegments, Points, PointsMaterial, type CanvasTexture } from 'three'
import type { Season, TimeOfDay } from '@/domain/environment'
import type { WeatherKind } from '@/domain/moods'
import { dotTexture, heartTexture, sparkTexture } from './textures'

export type Quality = 'low' | 'medium' | 'high'
export const QUALITY_SCALE: Record<Quality, number> = { low: 0.35, medium: 0.7, high: 1 }

const BOX = { x0: -3.2, x1: 3.2, y0: 0, y1: 4.2, z0: -1.8, z1: 2.6 }
const rand = (min: number, max: number) => min + Math.random() * (max - min)

interface Layer {
  object: LineSegments | Points
  material: LineBasicMaterial | PointsMaterial
  target: number
  value: number
  max: number
}

/**
 * Weather and environmental particles. Each layer fades toward a target
 * opacity; layers that have faded out are hidden and cost nothing to render.
 */
export class WeatherSystem {
  readonly group = new Group()
  private readonly layers: Record<'rain' | 'stars' | 'motes' | 'hearts' | 'season', Layer>
  private readonly textures: CanvasTexture[] = []
  private readonly pixelRatio: number

  private rainBase: Float32Array
  private moteBase: Float32Array
  private heartBase: Float32Array
  private starBase: Float32Array
  private seasonBase: Float32Array
  private seasonKind: Season = 'winter'

  constructor(quality: Quality, pixelRatio: number) {
    this.pixelRatio = pixelRatio
    const dot = dotTexture()
    const spark = sparkTexture()
    const heart = heartTexture()
    this.textures.push(dot, spark, heart)
    const scale = QUALITY_SCALE[quality]

    const rainCount = Math.round(700 * scale)
    this.rainBase = new Float32Array(rainCount * 3)
    for (let i = 0; i < rainCount; i++) this.randomisePosition(this.rainBase, i)
    const rain = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0xcde6ff, transparent: true, opacity: 0, depthWrite: false }))
    rain.geometry.setAttribute('position', new BufferAttribute(new Float32Array(rainCount * 6), 3))
    rain.frustumCulled = false

    this.starBase = new Float32Array(Math.round(160 * scale) * 3)
    for (let i = 0; i < this.starBase.length / 3; i++) {
      this.starBase[i * 3] = rand(-2.2, 2.3)
      this.starBase[i * 3 + 1] = rand(0.7, 2.4)
      this.starBase[i * 3 + 2] = rand(-1.5, -1.2)
    }
    const stars = this.points(this.starBase.length / 3, spark, 0xfff6e0, 12)

    this.moteBase = new Float32Array(Math.round(90 * scale) * 3)
    for (let i = 0; i < this.moteBase.length / 3; i++) this.randomisePosition(this.moteBase, i)
    const motes = this.points(this.moteBase.length / 3, dot, 0xfff6a1, 16)

    this.heartBase = new Float32Array(Math.max(8, Math.round(36 * scale)) * 3)
    for (let i = 0; i < this.heartBase.length / 3; i++) this.randomisePosition(this.heartBase, i)
    const hearts = this.points(this.heartBase.length / 3, heart, 0xff8fbe, 22)

    this.seasonBase = new Float32Array(Math.max(10, Math.round(110 * scale)) * 3)
    for (let i = 0; i < this.seasonBase.length / 3; i++) this.randomisePosition(this.seasonBase, i)
    const seasonal = this.points(this.seasonBase.length / 3, dot, 0xffffff, 14)

    this.layers = {
      rain: { object: rain, material: rain.material as LineBasicMaterial, target: 0, value: 0, max: 0.4 },
      stars: { object: stars, material: stars.material as PointsMaterial, target: 0, value: 0, max: 0.95 },
      motes: { object: motes, material: motes.material as PointsMaterial, target: 0, value: 0, max: 0.85 },
      hearts: { object: hearts, material: hearts.material as PointsMaterial, target: 0, value: 0, max: 0.8 },
      season: { object: seasonal, material: seasonal.material as PointsMaterial, target: 0, value: 0, max: 0.85 },
    }
    for (const layer of Object.values(this.layers)) {
      layer.object.visible = false
      layer.object.frustumCulled = false
      this.group.add(layer.object)
    }
  }

  private points(count: number, map: CanvasTexture, color: number, size: number): Points {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
    return new Points(
      geometry,
      new PointsMaterial({ map, color, size: size * this.pixelRatio, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    )
  }

  private randomisePosition(buffer: Float32Array, index: number): void {
    buffer[index * 3] = rand(BOX.x0, BOX.x1)
    buffer[index * 3 + 1] = rand(BOX.y0, BOX.y1)
    buffer[index * 3 + 2] = rand(BOX.z0, BOX.z1)
  }

  setWeather(kind: WeatherKind, density: number, nightClear: boolean): void {
    const d = Math.max(0, Math.min(1, density))
    const { rain, stars, motes, hearts } = this.layers
    rain.target = kind === 'rain' ? d : 0
    stars.target = kind === 'starlight' ? d : nightClear ? 0.35 : 0
    hearts.target = kind === 'hearts' ? d : 0
    const moteColors: Partial<Record<WeatherKind, number>> = { sunrise: 0xfff6a1, candle: 0xffc27a, sparkle: 0xfff4a8, cozy: 0xffd9a8, busy: 0xffcd7b, hearts: 0xffb4c9 }
    const moteColor = moteColors[kind]
    motes.target = moteColor !== undefined ? d : 0
    if (moteColor !== undefined) (motes.material as PointsMaterial).color = new Color(moteColor)
  }

  /** Snow in winter, blossom in spring, fireflies on summer evenings, falling leaves in autumn. */
  setSeason(season: Season, timeOfDay: TimeOfDay, weather: WeatherKind): void {
    const layer = this.layers.season
    const material = layer.material as PointsMaterial
    this.seasonKind = season
    const style: Record<Season, { color: number; size: number }> = {
      winter: { color: 0xffffff, size: 13 },
      spring: { color: 0xffc3da, size: 15 },
      summer: { color: 0xeaff7a, size: 17 },
      autumn: { color: 0xe8863a, size: 15 },
    }
    material.color = new Color(style[season].color)
    material.size = style[season].size * this.pixelRatio
    const dark = timeOfDay === 'dusk' || timeOfDay === 'night' || timeOfDay === 'dawn'
    const base = season === 'summer' ? (dark ? 0.75 : 0) : 0.7 // fireflies only come out when it is getting dark
    layer.target = weather === 'rain' ? (season === 'winter' ? 0.25 : 0) : base
  }

  /** Returns true while anything is visible or fading (so the scene keeps rendering). */
  update(delta: number, time: number, reducedMotion: boolean): boolean {
    let active = false
    const fade = 1 - Math.exp(-delta * 2.2)
    for (const layer of Object.values(this.layers)) {
      layer.value += (layer.target - layer.value) * fade
      if (layer.value < 0.01 && layer.target === 0) layer.value = 0
      layer.object.visible = layer.value > 0
      layer.material.opacity = layer.value * layer.max
      if (layer.object.visible) active = true
    }
    if (!active) return false

    const { rain, stars, motes, hearts, season } = this.layers
    const speed = reducedMotion ? 0 : 1
    if (rain.object.visible) this.updateRain(rain.object as LineSegments, delta * speed)
    if (stars.object.visible) {
      this.writePoints(stars.object as Points, this.starBase)
      if (!reducedMotion) stars.material.opacity = stars.value * stars.max * (0.65 + 0.35 * Math.sin(time * 1.7))
    }
    if (motes.object.visible) this.updateRising(motes.object as Points, this.moteBase, delta * speed, 0.14, time)
    if (hearts.object.visible) this.updateRising(hearts.object as Points, this.heartBase, delta * speed, 0.22, time)
    if (season.object.visible) this.updateSeason(season.object as Points, delta * speed, time, reducedMotion)
    return true
  }

  private updateSeason(points: Points, delta: number, time: number, reducedMotion: boolean): void {
    const base = this.seasonBase
    const count = base.length / 3
    const firefly = this.seasonKind === 'summer'
    const fall = this.seasonKind === 'winter' ? 0.32 : this.seasonKind === 'spring' ? 0.24 : 0.4
    for (let i = 0; i < count; i++) {
      if (firefly) {
        // Slow, aimless drift near the floor and walls; each one wanders on its own phase.
        base[i * 3] = base[i * 3]! + Math.sin(time * 0.4 + i * 1.7) * delta * 0.25
        base[i * 3 + 1] = Math.min(2.4, Math.max(0.1, base[i * 3 + 1]! + Math.cos(time * 0.5 + i * 2.3) * delta * 0.18))
      } else {
        base[i * 3 + 1] = base[i * 3 + 1]! - delta * fall * (0.6 + (i % 5) * 0.15)
        base[i * 3] = base[i * 3]! + Math.sin(time * 0.9 + i) * delta * 0.12
        if (base[i * 3 + 1]! < BOX.y0) {
          base[i * 3 + 1] = BOX.y1
          base[i * 3] = rand(BOX.x0, BOX.x1)
        }
      }
    }
    const positions = points.geometry.getAttribute('position') as BufferAttribute
    const array = positions.array as Float32Array
    array.set(base)
    positions.needsUpdate = true
    if (firefly && !reducedMotion) (points.material as PointsMaterial).opacity = this.layers.season.value * this.layers.season.max * (0.55 + 0.45 * Math.sin(time * 2.2))
  }

  private updateRain(lines: LineSegments, delta: number): void {
    const positions = lines.geometry.getAttribute('position') as BufferAttribute
    const array = positions.array as Float32Array
    const count = this.rainBase.length / 3
    const base = this.rainBase
    for (let i = 0; i < count; i++) {
      let x = base[i * 3]! - delta * 0.9
      let y = base[i * 3 + 1]! - delta * 6.5
      const z = base[i * 3 + 2]!
      if (y < BOX.y0) {
        y = BOX.y1
        x = rand(BOX.x0, BOX.x1 + 1)
      }
      base[i * 3] = x
      base[i * 3 + 1] = y
      array.set([x, y, z, x + 0.05, y + 0.3, z], i * 6)
    }
    positions.needsUpdate = true
  }

  private updateRising(points: Points, base: Float32Array, delta: number, rise: number, time: number): void {
    const count = base.length / 3
    for (let i = 0; i < count; i++) {
      base[i * 3 + 1] = base[i * 3 + 1]! + delta * rise * (0.6 + (i % 5) * 0.15)
      if (base[i * 3 + 1]! > BOX.y1) {
        base[i * 3 + 1] = BOX.y0
        base[i * 3] = rand(BOX.x0, BOX.x1)
      }
    }
    const positions = points.geometry.getAttribute('position') as BufferAttribute
    const array = positions.array as Float32Array
    for (let i = 0; i < count; i++) {
      array[i * 3] = base[i * 3]! + Math.sin(time * 0.8 + i) * 0.05
      array[i * 3 + 1] = base[i * 3 + 1]!
      array[i * 3 + 2] = base[i * 3 + 2]!
    }
    positions.needsUpdate = true
  }

  private writePoints(points: Points, base: Float32Array): void {
    const positions = points.geometry.getAttribute('position') as BufferAttribute
    if ((positions.array as Float32Array)[1] === base[1]) return
    ;(positions.array as Float32Array).set(base)
    positions.needsUpdate = true
  }

  dispose(): void {
    for (const layer of Object.values(this.layers)) {
      layer.object.geometry.dispose()
      layer.material.dispose()
    }
    this.textures.forEach((texture) => texture.dispose())
    this.group.clear()
  }
}
