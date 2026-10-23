import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, type Object3D } from 'three'
import type { PlantPlacement } from '@/domain/garden'

/** Small 3D rendering of the shared garden, parented to the planter's `garden_anchor` node. */
export class GardenView {
  private readonly group = new Group()
  private readonly stem = new CylinderGeometry(0.012, 0.016, 1, 6)
  private readonly bloom = new SphereGeometry(1, 10, 8)
  private readonly stemMaterial = new MeshStandardMaterial({ color: 0x2f8a4a, roughness: 0.8 })
  private readonly bloomMaterials = new Map<string, MeshStandardMaterial>()

  constructor(anchor: Object3D | null) {
    this.group.name = 'garden_plants'
    anchor?.add(this.group)
    // Slightly above the soil, spread along the planter's length.
    this.group.position.set(0, 0.16, 0)
  }

  get attached(): boolean {
    return this.group.parent !== null
  }

  set(placements: readonly PlantPlacement[]): void {
    this.group.clear()
    for (const placement of placements) {
      const height = 0.05 + placement.stage * 0.06
      const stem = new Mesh(this.stem, this.stemMaterial)
      stem.scale.set(1, height, 1)
      stem.position.set((placement.x - 0.5) * 1.15, height / 2, (placement.y - 0.5) * 0.12)
      const bloom = new Mesh(this.bloom, this.materialFor(placement.color))
      const radius = 0.018 + placement.stage * 0.012
      bloom.scale.setScalar(radius)
      bloom.position.set(stem.position.x, height + radius * 0.6, stem.position.z)
      this.group.add(stem, bloom)
    }
  }

  private materialFor(color: string): MeshStandardMaterial {
    let material = this.bloomMaterials.get(color)
    if (!material) {
      material = new MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.15 })
      this.bloomMaterials.set(color, material)
    }
    return material
  }

  dispose(): void {
    this.group.removeFromParent()
    this.group.clear()
    this.stem.dispose()
    this.bloom.dispose()
    this.stemMaterial.dispose()
    this.bloomMaterials.forEach((material) => material.dispose())
    this.bloomMaterials.clear()
  }
}
