import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, TextureLoader, type Texture } from 'three'

const MAX_FRAMES = 8
const FRAME = 0.34
const WALL_Z = -1.66
const ROW_Y = 2.2

/**
 * A strip of framed photos along the top of the back wall. Photos are loaded from the browser's own storage (blob URLs),
 * each fitted into a square frame by its real proportions. Placeholder art, like the rest of the room: a real Blender
 * wall can replace it.
 */
export class PhotoWall {
  readonly group = new Group()
  private urls: string[] = []
  private textures: Texture[] = []
  private generation = 0

  constructor(private readonly onChange: () => void) {
    this.group.name = 'photo_wall'
  }

  set(urls: readonly string[]): void {
    const next = urls.slice(0, MAX_FRAMES)
    if (next.length === this.urls.length && next.every((url, i) => url === this.urls[i])) return
    this.urls = next
    this.clear()
    const generation = ++this.generation
    const count = next.length
    next.forEach((url, i) => {
      const x = (i - (count - 1) / 2) * (FRAME + 0.18)
      const frame = new Group()
      frame.position.set(x, ROW_Y, WALL_Z + 0.03)
      frame.rotation.z = ((i % 3) - 1) * 0.025
      const border = new Mesh(new BoxGeometry(FRAME + 0.05, FRAME + 0.05, 0.03), new MeshBasicMaterial({ color: 0xe9d3a8 }))
      const picture = new Mesh(new PlaneGeometry(FRAME, FRAME), new MeshBasicMaterial({ color: 0x3a2a30 }))
      picture.position.z = 0.02
      frame.add(border, picture)
      this.group.add(frame)
      new TextureLoader().load(
        url,
        (texture) => {
          if (generation !== this.generation) return texture.dispose()
          texture.colorSpace = SRGBColorSpace
          const image = texture.image as { width: number; height: number }
          const aspect = image.width / image.height || 1
          picture.geometry.dispose()
          picture.geometry = new PlaneGeometry(aspect >= 1 ? FRAME : FRAME * aspect, aspect >= 1 ? FRAME / aspect : FRAME)
          ;(picture.material as MeshBasicMaterial).map = texture
          ;(picture.material as MeshBasicMaterial).color.set(0xffffff)
          ;(picture.material as MeshBasicMaterial).needsUpdate = true
          this.textures.push(texture)
          this.onChange()
        },
        undefined,
        () => undefined, // an unreadable photo just stays an empty frame
      )
    })
    this.onChange()
  }

  private clear(): void {
    for (const child of [...this.group.children]) {
      child.traverse((node) => {
        const mesh = node as Mesh
        if (!mesh.isMesh) return
        mesh.geometry.dispose()
        ;(mesh.material as MeshBasicMaterial).dispose()
      })
      this.group.remove(child)
    }
    this.textures.forEach((texture) => texture.dispose())
    this.textures = []
  }

  dispose(): void {
    this.generation++
    this.clear()
  }
}
