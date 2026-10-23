import { Box3, Group, Sprite, SpriteMaterial, Vector3, type CanvasTexture, type Object3D } from 'three'
import { envelopeTexture } from './textures'

/** Floating envelope markers over objects that carry unread hidden notes. */
export class NoteBeacons {
  readonly group = new Group()
  private readonly texture: CanvasTexture = envelopeTexture()
  private readonly sprites = new Map<string, Sprite>()

  constructor(private readonly roots: ReadonlyMap<string, Object3D>) {}

  set(counts: ReadonlyMap<string, number>): void {
    for (const [id, sprite] of this.sprites) {
      if (!counts.has(id)) {
        sprite.material.dispose()
        this.group.remove(sprite)
        this.sprites.delete(id)
      }
    }
    for (const [id, count] of counts) {
      if (count <= 0 || this.sprites.has(id)) continue
      const root = this.roots.get(id)
      if (!root) continue
      const bounds = new Box3().setFromObject(root)
      const top = bounds.getCenter(new Vector3())
      top.y = bounds.max.y + 0.28
      const sprite = new Sprite(new SpriteMaterial({ map: this.texture, transparent: true, depthTest: false }))
      sprite.scale.set(0.36, 0.36, 1)
      sprite.position.copy(top)
      sprite.userData.baseY = top.y
      sprite.renderOrder = 10
      this.sprites.set(id, sprite)
      this.group.add(sprite)
    }
  }

  get hasBeacons(): boolean {
    return this.sprites.size > 0
  }

  update(time: number, reducedMotion: boolean): boolean {
    if (this.sprites.size === 0) return false
    let index = 0
    for (const sprite of this.sprites.values()) {
      const baseY = sprite.userData.baseY as number
      sprite.position.y = reducedMotion ? baseY : baseY + Math.sin(time * 2 + index) * 0.04
      const pulse = reducedMotion ? 1 : 1 + Math.sin(time * 3 + index) * 0.08
      sprite.scale.set(0.36 * pulse, 0.36 * pulse, 1)
      index++
    }
    return !reducedMotion
  }

  dispose(): void {
    for (const sprite of this.sprites.values()) sprite.material.dispose()
    this.sprites.clear()
    this.texture.dispose()
    this.group.clear()
  }
}
