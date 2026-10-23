import { Color, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'

export type HighlightLevel = 'none' | 'hover' | 'focus' | 'selected'
const STRENGTH: Record<HighlightLevel, number> = { none: 0, hover: 0.18, focus: 0.34, selected: 0.4 }

interface Tracked {
  material: MeshStandardMaterial
  baseColor: Color
  baseIntensity: number
}

interface Entry {
  tracked: Tracked[]
  tint: Color
  level: HighlightLevel
  /** 0..1 eased current strength. */
  current: number
}

type Emissive = MeshStandardMaterial & { emissive: Color; emissiveIntensity: number }

function hasEmissive(material: Material): material is Emissive {
  return 'emissive' in material
}

/**
 * Emissive highlighting. Materials are CLONED per interactive object up front,
 * because placeholder and imported assets frequently share one material across
 * many objects and tinting a shared material would light them all up.
 */
export class HighlightController {
  private readonly entries = new Map<string, Entry>()

  constructor(roots: ReadonlyMap<string, Object3D>, tints: ReadonlyMap<string, number>) {
    for (const [id, root] of roots) {
      const tracked: Tracked[] = []
      root.traverse((node) => {
        const mesh = node as Mesh
        if (!mesh.isMesh || mesh.userData.hitProxy) return
        const clone = (m: Material): Material => {
          const copy = m.clone()
          if (hasEmissive(copy)) tracked.push({ material: copy, baseColor: copy.emissive.clone(), baseIntensity: copy.emissiveIntensity })
          return copy
        }
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material)
      })
      this.entries.set(id, { tracked, tint: new Color(tints.get(id) ?? 0xffffff), level: 'none', current: 0 })
    }
  }

  set(id: string, level: HighlightLevel): void {
    const entry = this.entries.get(id)
    if (entry) entry.level = level
  }

  clearExcept(...keep: (string | null)[]): void {
    for (const [id, entry] of this.entries) if (!keep.includes(id)) entry.level = 'none'
  }

  /** Returns true while anything is still animating (so the caller can keep rendering). */
  update(timeSeconds: number, deltaSeconds: number, reducedMotion: boolean): boolean {
    let active = false
    const ease = 1 - Math.exp(-deltaSeconds * 10)
    for (const entry of this.entries.values()) {
      const pulse = !reducedMotion && (entry.level === 'focus' || entry.level === 'selected') ? 0.12 * Math.sin(timeSeconds * 4) : 0
      const goal = STRENGTH[entry.level] > 0 ? STRENGTH[entry.level] + pulse : 0
      entry.current += (goal - entry.current) * ease
      if (Math.abs(goal - entry.current) > 0.002) active = true
      for (const t of entry.tracked) {
        t.material.emissive.copy(t.baseColor).lerp(entry.tint, Math.min(1, entry.current))
        t.material.emissiveIntensity = t.baseIntensity + entry.current * 0.45
      }
      if (entry.level !== 'none') active = true
    }
    return active
  }

  dispose(): void {
    for (const entry of this.entries.values()) for (const t of entry.tracked) t.material.dispose()
    this.entries.clear()
  }
}
