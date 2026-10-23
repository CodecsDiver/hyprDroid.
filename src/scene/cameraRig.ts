import { MathUtils, OrthographicCamera, Vector3 } from 'three'
import type { CameraPreset } from '@/registry/interactionRegistry'

const VIEW_HEIGHT = 6.6
const HOME_TARGET = new Vector3(0, 0.95, -0.1)
const BASE_OFFSET = new Vector3(4.2, 3.7, 5.2)
const MAX_YAW = 0.6
const MIN_ZOOM = 0.8
const MAX_ZOOM = 3.2

/**
 * Orthographic isometric camera with smooth navigation: limited orbit, zoom,
 * and animated focus on an object. With reduced motion every move is instant.
 */
export class CameraRig {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 60)
  private yaw = 0
  private yawGoal = 0
  private zoom = 1
  private zoomGoal = 1
  private readonly target = HOME_TARGET.clone()
  private readonly targetGoal = HOME_TARGET.clone()
  private aspect = 1
  private focused = false
  private viewportPx = { w: 1, h: 1 }
  private inset = { x: 0, y: 0 }
  private insetGoal = { x: 0, y: 0 }

  constructor(private readonly isReducedMotion: () => boolean) {
    this.applyFrustum()
    this.apply()
  }

  get isFocused(): boolean {
    return this.focused
  }

  setViewport(width: number, height: number): void {
    this.viewportPx = { w: Math.max(1, width), h: Math.max(1, height) }
    this.aspect = width / Math.max(1, height)
    this.applyFrustum()
  }

  orbit(deltaYaw: number): void {
    this.yawGoal = MathUtils.clamp(this.yawGoal + deltaYaw, -MAX_YAW, MAX_YAW)
    if (this.isReducedMotion()) {
      this.yaw = this.yawGoal
      this.apply()
    }
  }

  releaseOrbit(): void {
    if (!this.focused) this.yawGoal = 0
  }

  /**
   * Shifts the picture so the focused object sits in the part of the screen a panel
   * leaves free (in CSS pixels: x > 0 moves the scene left, y > 0 moves it up).
   */
  setPanelInset(px: { x: number; y: number }): void {
    this.insetGoal = { ...px }
    if (this.isReducedMotion()) {
      this.inset = { ...px }
      this.apply()
    }
  }

  zoomBy(factor: number): void {
    this.zoomGoal = MathUtils.clamp(this.zoomGoal * factor, MIN_ZOOM, MAX_ZOOM)
    if (this.isReducedMotion()) {
      this.zoom = this.zoomGoal
      this.apply()
    }
  }

  focus(preset: CameraPreset | null): void {
    this.focused = preset !== null
    this.targetGoal.set(...(preset?.target ?? [HOME_TARGET.x, HOME_TARGET.y, HOME_TARGET.z]))
    this.zoomGoal = preset?.zoom ?? 1
    if (!preset) this.yawGoal = 0
    if (this.isReducedMotion()) {
      this.target.copy(this.targetGoal)
      this.zoom = this.zoomGoal
      this.yaw = this.yawGoal
      this.apply()
    }
  }

  /** Advances the animation. Returns true while the camera is still moving. */
  update(deltaSeconds: number): boolean {
    const ease = 1 - Math.exp(-deltaSeconds * (this.isReducedMotion() ? 60 : 5.5))
    const before = this.signature()
    this.yaw += (this.yawGoal - this.yaw) * ease
    this.zoom += (this.zoomGoal - this.zoom) * ease
    this.target.lerp(this.targetGoal, ease)
    this.inset.x += (this.insetGoal.x - this.inset.x) * ease
    this.inset.y += (this.insetGoal.y - this.inset.y) * ease
    this.apply()
    return this.signature() !== before
  }

  private signature(): string {
    return [this.yaw, this.zoom, this.target.x, this.target.y, this.target.z, this.inset.x, this.inset.y].map((v) => v.toFixed(4)).join('|')
  }

  private applyFrustum(): void {
    const halfH = VIEW_HEIGHT / 2
    const halfW = halfH * this.aspect
    // On portrait screens keep the room's width visible rather than its height.
    const fit = this.aspect < 0.9 ? 0.9 / this.aspect : 1
    this.camera.left = -halfW * fit
    this.camera.right = halfW * fit
    this.camera.top = halfH * fit
    this.camera.bottom = -halfH * fit
    this.camera.updateProjectionMatrix()
  }

  private apply(): void {
    this.camera.zoom = this.zoom
    const offset = BASE_OFFSET.clone().applyAxisAngle(new Vector3(0, 1, 0), this.yaw)
    this.camera.position.copy(this.target).add(offset)
    this.camera.lookAt(this.target)
    const { w, h } = this.viewportPx
    if (Math.abs(this.inset.x) > 0.5 || Math.abs(this.inset.y) > 0.5) this.camera.setViewOffset(w, h, this.inset.x, this.inset.y, w, h)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
  }
}
