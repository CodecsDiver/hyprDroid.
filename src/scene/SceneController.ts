import { Clock, Fog, Raycaster, SRGBColorSpace, Vector2, WebGLRenderer, Scene, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, type Object3D } from 'three'
import type { EnvironmentState } from '@/domain/environment'
import type { PlantPlacement } from '@/domain/garden'
import type { AssetManifest, AssetResolver } from '@/assets/manifest'
import { INTERACTIONS, WELL_KNOWN_NODES, getInteraction, type InteractionDefinition } from '@/registry/interactionRegistry'
import { NoteBeacons } from './beacons'
import { CameraRig } from './cameraRig'
import { GardenView } from './garden3d'
import { HighlightController } from './highlight'
import { LightingRig } from './lighting'
import { AnimationDirector, buildHouse, type HouseBuild } from './loader'
import { pickInteraction } from './picking'
import { disposeObject } from './placeholders'
import { WeatherSystem, type Quality } from './weather'

export interface SceneOptions {
  host: HTMLElement
  manifest: AssetManifest
  resolver: AssetResolver
  quality: Quality
  isReducedMotion: () => boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  onContextLost?: () => void
  definitions?: readonly InteractionDefinition[]
}

export interface SceneInfo {
  fromAsset: boolean
  placeholders: string[]
  missing: string[]
  warnings: string[]
}

const TAP_MAX_MOVE_PX = 8
const TAP_MAX_MS = 600

/**
 * Owns the WebGL renderer and everything in the scene. It knows nothing about
 * features: it reports selections by registry id and is driven by plain data
 * (environment, rose stage, unread notes, garden plants).
 */
export class SceneController {
  readonly info: SceneInfo
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly rig: CameraRig
  private readonly lighting = new LightingRig()
  private readonly weather: WeatherSystem
  private readonly highlight: HighlightController
  private readonly beacons: NoteBeacons
  private readonly garden: GardenView
  private readonly animations: AnimationDirector
  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()
  private readonly clock = new Clock()
  private readonly resizeObserver: ResizeObserver
  private readonly pulses = new Map<string, number>()
  private readonly baseScale = new Map<string, number>()

  private raf = 0
  private dirty = true
  private paused = false
  private disposed = false
  private hoverId: string | null = null
  private focusId: string | null = null
  private selectedId: string | null = null
  private environment: EnvironmentState | null = null
  private roseStage = 0
  private lastRender = 0

  private readonly bloom: Object3D | null
  private readonly aura: Mesh | null
  private readonly lampBulb: Mesh | null
  private readonly lampHalo: Mesh | null

  // Gesture state
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private downAt = 0
  private downPos = { x: 0, y: 0 }
  private moved = false
  private pinchDistance = 0

  private constructor(private readonly o: SceneOptions, private readonly house: HouseBuild) {
    const quality = o.quality
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1)
    this.renderer = new WebGLRenderer({ antialias: quality !== 'low', alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(dpr)
    this.renderer.outputColorSpace = SRGBColorSpace
    const canvas = this.renderer.domElement
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none'
    canvas.setAttribute('aria-hidden', 'true') // the object list is the accessible interface
    o.host.appendChild(canvas)

    this.rig = new CameraRig(o.isReducedMotion)
    this.scene.add(house.root, this.lighting.group)
    this.weather = new WeatherSystem(quality, dpr)
    this.scene.add(this.weather.group)

    const tints = new Map((o.definitions ?? INTERACTIONS).map((d) => [d.id, d.highlight]))
    this.highlight = new HighlightController(house.roots, tints)
    this.beacons = new NoteBeacons(house.roots)
    this.scene.add(this.beacons.group)
    this.garden = new GardenView(this.findNode(WELL_KNOWN_NODES.gardenAnchor))
    this.animations = new AnimationDirector(house.root, house.animations, o.manifest.animations)

    this.bloom = this.findNode(WELL_KNOWN_NODES.roseBloom)
    this.aura = this.findNode(WELL_KNOWN_NODES.roseAura) as Mesh | null
    this.lampBulb = this.findNode('lamp_bulb') as Mesh | null
    this.lampHalo = this.findNode('lamp_halo') as Mesh | null
    for (const id of house.roots.keys()) this.baseScale.set(id, house.roots.get(id)?.scale.x ?? 1)
    const lamp = house.roots.get('obj_ceiling_lamp')
    if (lamp) {
      const p = lamp.getWorldPosition(lamp.position.clone())
      this.lighting.setLampPosition(p.x, p.y - 0.1, p.z + 0.05)
    }

    this.info = { fromAsset: house.fromAsset, placeholders: house.placeholders, missing: house.missing, warnings: house.warnings }

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerCancel)
    canvas.addEventListener('pointerleave', this.onPointerLeave)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    canvas.addEventListener('webglcontextlost', this.onContextLost)
    canvas.addEventListener('webglcontextrestored', this.onContextRestored)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(o.host)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.resize()
    this.raf = requestAnimationFrame(this.tick)
  }

  static async create(options: SceneOptions): Promise<SceneController> {
    const house = await buildHouse(options.manifest, options.resolver, options.definitions)
    for (const warning of house.warnings) console.warn(`[scene] ${warning}`)
    return new SceneController(options, house)
  }

  // ---------------------------------------------------------------- public API

  setEnvironment(env: EnvironmentState): void {
    this.environment = env
    this.lighting.apply(env)
    this.weather.setWeather(env.weather, env.particleDensity, env.timeOfDay === 'night' && env.weather === 'clear')
    // The orthographic camera sits ~7.6 units from the room centre, so fog distances are offset to match.
    this.scene.fog = env.fog ? new Fog(env.fog.color, env.fog.near + 3, env.fog.far + 5.5) : null
    this.dirty = true
  }

  setRoseStage(stage: number): void {
    this.roseStage = Math.max(0, Math.min(5, stage))
    this.dirty = true
  }

  setUnreadNotes(counts: ReadonlyMap<string, number>): void {
    this.beacons.set(counts)
    for (const id of this.house.roots.keys()) this.animations.setActive(id, 'unread-note', (counts.get(id) ?? 0) > 0)
    this.dirty = true
  }

  setGarden(placements: readonly PlantPlacement[]): void {
    this.garden.set(placements)
    this.dirty = true
  }

  /** Keyboard / screen-reader focus ring (mirrors the accessible object list). */
  setFocused(id: string | null): void {
    this.focusId = id
    this.applyHighlights()
  }

  /** Visually marks the object whose panel is open. */
  setSelected(id: string | null): void {
    this.selectedId = id
    this.applyHighlights()
  }

  /** Animates the camera to an object's preset, or back to the whole room with `null`. */
  focusObject(id: string | null): void {
    const definition = id ? (this.o.definitions ?? INTERACTIONS).find((d) => d.id === id) ?? getInteraction(id) : undefined
    this.rig.focus(definition ? definition.camera : null)
    this.dirty = true
  }

  /** Tells the camera how much of the screen a panel covers so the focused object stays visible. */
  setPanelInset(px: { x: number; y: number }): void {
    this.rig.setPanelInset(px)
    this.dirty = true
  }

  /** Brief feedback when an object is activated. */
  pulse(id: string): void {
    this.animations.fire(id, 'select')
    if (!this.o.isReducedMotion()) this.pulses.set(id, performance.now())
    this.dirty = true
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    if (!paused) this.dirty = true
  }

  /** Keyboard camera controls for the focused scene. */
  nudge(action: 'left' | 'right' | 'in' | 'out'): void {
    if (action === 'left') this.rig.orbit(-0.12)
    else if (action === 'right') this.rig.orbit(0.12)
    else this.rig.zoomBy(action === 'in' ? 1.15 : 1 / 1.15)
    this.dirty = true
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    document.removeEventListener('visibilitychange', this.onVisibility)
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('pointercancel', this.onPointerCancel)
    canvas.removeEventListener('pointerleave', this.onPointerLeave)
    canvas.removeEventListener('wheel', this.onWheel)
    canvas.removeEventListener('webglcontextlost', this.onContextLost)
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored)
    this.animations.dispose()
    this.highlight.dispose()
    this.beacons.dispose()
    this.garden.dispose()
    this.weather.dispose()
    this.lighting.dispose()
    disposeObject(this.house.root)
    this.scene.clear()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    canvas.remove()
  }

  // ------------------------------------------------------------------ internals

  private findNode(name: string): Object3D | null {
    return this.house.root.getObjectByName(name) ?? null
  }

  private applyHighlights(): void {
    this.highlight.clearExcept(this.hoverId, this.focusId, this.selectedId)
    if (this.hoverId) this.highlight.set(this.hoverId, 'hover')
    if (this.focusId) this.highlight.set(this.focusId, 'focus')
    if (this.selectedId) this.highlight.set(this.selectedId, 'selected')
    this.dirty = true
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.o.host
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.rig.setViewport(w, h)
    this.dirty = true
  }

  private readonly tick = (now: number): void => {
    this.raf = requestAnimationFrame(this.tick)
    if (this.disposed || this.paused || document.hidden) {
      this.clock.getDelta() // keep delta small when resuming
      return
    }
    if (this.o.quality === 'low' && now - this.lastRender < 32) return
    this.lastRender = now

    const delta = Math.min(this.clock.getDelta(), 0.1)
    const time = this.clock.elapsedTime
    const reduced = this.o.isReducedMotion()

    let active = this.rig.update(delta)
    active = this.lighting.update(delta) || active
    active = this.weather.update(delta, time, reduced) || active
    active = this.highlight.update(time, delta, reduced) || active
    active = this.beacons.update(time, reduced) || active
    active = this.animations.update(delta) || active
    active = this.updatePulses(now) || active
    active = this.updateRoseAndLamp(time, reduced) || active

    if (active || this.dirty) {
      this.dirty = false
      this.renderer.render(this.scene, this.rig.camera)
    }
  }

  private updatePulses(now: number): boolean {
    if (this.pulses.size === 0) return false
    for (const [id, start] of this.pulses) {
      const root = this.house.roots.get(id)
      const base = this.baseScale.get(id) ?? 1
      const t = (now - start) / 380
      if (!root || t >= 1) {
        root?.scale.setScalar(base)
        this.pulses.delete(id)
      } else {
        root.scale.setScalar(base * (1 + Math.sin(t * Math.PI) * 0.12))
      }
    }
    return true
  }

  private updateRoseAndLamp(time: number, reduced: boolean): boolean {
    const env = this.environment
    let animating = false
    const stage = this.roseStage
    if (this.bloom) this.bloom.scale.setScalar(0.8 + stage * 0.1)
    if (this.aura) {
      const material = this.aura.material as MeshBasicMaterial & MeshStandardMaterial
      const wave = reduced ? 0 : Math.sin(time * 4)
      let opacity = 0.035 + stage * 0.025 + wave * (0.012 + stage * 0.006)
      let scale = 1 + stage * 0.055
      let color = 0xff77a6
      if (env?.weather === 'sunrise') ([opacity, scale, color] = [0.58 + wave * 0.16, 1.68 + wave * 0.1, 0xffd34d])
      else if (env?.weather === 'hearts') ([opacity, scale, color] = [0.26 + wave * 0.08, 1.24 + wave * 0.05, 0xffa6c8])
      material.opacity = opacity
      material.color.setHex(color)
      this.aura.scale.setScalar(scale)
      animating = !reduced
    }
    if (env) {
      if (this.lampBulb) {
        const material = this.lampBulb.material as MeshStandardMaterial
        material.emissive.setHex(env.lamp.color)
        material.emissiveIntensity += (Math.min(env.lamp.intensity, 3.2) - material.emissiveIntensity) * 0.08
      }
      if (this.lampHalo) {
        const material = this.lampHalo.material as MeshBasicMaterial
        material.color.setHex(env.lamp.color)
        material.opacity += (env.lamp.halo - material.opacity) * 0.08
      }
    }
    return animating
  }

  // --------------------------------------------------------------------- input

  private setPointerFrom(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
  }

  private pick(event: PointerEvent): string | null {
    this.setPointerFrom(event)
    return pickInteraction(this.raycaster, this.pointer, this.rig.camera, this.house.roots)
  }

  private setHover(id: string | null): void {
    if (id === this.hoverId) return
    if (this.hoverId) this.animations.setActive(this.hoverId, 'hover', false)
    this.hoverId = id
    if (id) this.animations.setActive(id, 'hover', true)
    this.o.host.style.cursor = id ? 'pointer' : ''
    this.o.onHover(id)
    this.applyHighlights()
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.renderer.domElement.setPointerCapture?.(event.pointerId)
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (this.pointers.size === 1) {
      this.downAt = performance.now()
      this.downPos = { x: event.clientX, y: event.clientY }
      this.moved = false
    } else if (this.pointers.size === 2) {
      this.moved = true // a second finger turns the gesture into a pinch, never a tap
      this.pinchDistance = this.currentPinchDistance()
    }
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId)
    if (!previous) {
      if (event.pointerType === 'mouse') this.setHover(this.pick(event))
      return
    }
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (this.pointers.size === 2) {
      const distance = this.currentPinchDistance()
      if (this.pinchDistance > 0) this.rig.zoomBy(distance / this.pinchDistance)
      this.pinchDistance = distance
      this.dirty = true
      return
    }
    if (Math.hypot(event.clientX - this.downPos.x, event.clientY - this.downPos.y) > TAP_MAX_MOVE_PX) this.moved = true
    if (this.moved && !this.rig.isFocused) {
      this.rig.orbit((event.clientX - previous.x) * 0.006)
      this.dirty = true
    }
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    const wasTap = !this.moved && this.pointers.size === 1 && performance.now() - this.downAt < TAP_MAX_MS
    this.pointers.delete(event.pointerId)
    this.renderer.domElement.releasePointerCapture?.(event.pointerId)
    if (this.pointers.size < 2) this.pinchDistance = 0
    if (this.pointers.size === 0) this.rig.releaseOrbit()
    if (wasTap) {
      const id = this.pick(event)
      if (id) this.o.onSelect(id)
    }
    this.dirty = true
  }

  private readonly onPointerCancel = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId)
    this.pinchDistance = 0
    this.rig.releaseOrbit()
  }

  private readonly onPointerLeave = (): void => this.setHover(null)

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    this.rig.zoomBy(event.deltaY < 0 ? 1.08 : 1 / 1.08)
    this.dirty = true
  }

  private currentPinchDistance(): number {
    const [a, b] = [...this.pointers.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  private readonly onVisibility = (): void => {
    if (!document.hidden) this.dirty = true
  }

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault()
    this.o.onContextLost?.()
  }

  private readonly onContextRestored = (): void => {
    this.dirty = true
  }
}
