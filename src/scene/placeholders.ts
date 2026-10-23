/**
 * PLACEHOLDER GEOMETRY — not final artwork.
 *
 * Simple primitives that stand in for the Blender environment until it exists.
 * Every interactive object is a Group named with its registry id and tagged
 * `userData.placeholder = true`, exactly like a real asset would be named.
 */

import {
  BoxGeometry, BufferGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Object3D, SphereGeometry, Shape, type Material,
} from 'three'
import { INTERACTIONS, WELL_KNOWN_NODES, type InteractionDefinition } from '@/registry/interactionRegistry'

export const ROOM = { width: 4.6, depth: 3.4, height: 2.5 } as const

interface PartOptions {
  roughness?: number
  emissive?: number
  emissiveIntensity?: number
  opacity?: number
  name?: string
  rotation?: readonly [number, number, number]
}

function part(parent: Object3D, geometry: BufferGeometry, color: number, at: readonly [number, number, number], options: PartOptions = {}): Mesh {
  const material = new MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.8,
    metalness: 0.02,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 1,
    transparent: options.opacity !== undefined && options.opacity < 1,
    opacity: options.opacity ?? 1,
  })
  if (options.opacity !== undefined && options.opacity < 1) material.side = DoubleSide
  const mesh = new Mesh(geometry, material)
  mesh.position.set(...at)
  if (options.rotation) mesh.rotation.set(...options.rotation)
  if (options.name) mesh.name = options.name
  parent.add(mesh)
  return mesh
}

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d)
const cyl = (top: number, bottom: number, h: number, segments = 14) => new CylinderGeometry(top, bottom, h, segments)
const ball = (r: number) => new SphereGeometry(r, 16, 12)

function legs(parent: Object3D, color: number, x: number, z: number, height: number, thickness = 0.1): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(parent, box(thickness, height, thickness), color, [sx * x, height / 2, sz * z])
}

export function buildRoomShell(): Group {
  const shell = new Group()
  shell.name = 'room_shell'
  part(shell, box(ROOM.width, 0.12, ROOM.depth), 0x5a3428, [0, -0.06, 0], { name: 'floor' })
  part(shell, box(ROOM.width, ROOM.height, 0.12), 0x5a243e, [0, ROOM.height / 2, -ROOM.depth / 2 - 0.06], { name: 'wall_back' })
  part(shell, box(0.12, ROOM.height, ROOM.depth), 0x47233a, [-ROOM.width / 2 - 0.06, ROOM.height / 2, 0], { name: 'wall_left' })
  part(shell, box(1.8, 0.01, 1.3), 0x7a3a58, [0.2, 0.01, 0.1], { name: 'rug' })
  return shell
}

type Builder = (group: Group) => void

const BUILDERS: Record<string, Builder> = {
  obj_guitar(g) {
    const body = part(g, ball(0.28), 0xffd37a, [0, 0.46, 0])
    body.scale.set(0.82, 1.18, 0.34)
    part(g, cyl(0.07, 0.07, 0.04, 20), 0x2a1810, [0, 0.5, 0.1], { rotation: [Math.PI / 2, 0, 0] })
    part(g, box(0.08, 0.92, 0.05), 0x6b3f21, [0, 1.05, 0])
    part(g, box(0.18, 0.18, 0.06), 0x6b3f21, [0, 1.58, 0])
    g.rotation.z = 0.12
  },
  obj_spell_table(g) {
    part(g, box(1.15, 0.12, 0.65), 0x6e3e22, [0, 0.65, 0])
    part(g, box(1.05, 0.02, 0.34), 0x3a1050, [0, 0.72, 0])
    part(g, box(0.1, 0.65, 0.1), 0x4b2b19, [-0.48, 0.325, -0.25])
    part(g, box(0.1, 0.65, 0.1), 0x4b2b19, [0.48, 0.325, -0.25])
    part(g, box(0.1, 0.65, 0.1), 0x4b2b19, [-0.48, 0.325, 0.25])
    part(g, box(0.1, 0.65, 0.1), 0x4b2b19, [0.48, 0.325, 0.25])
    part(g, ball(0.15), 0xc9a7ff, [-0.15, 0.9, 0], { emissive: 0x7a4dff, emissiveIntensity: 0.6, opacity: 0.85, name: 'spell_glow' })
    part(g, cyl(0.035, 0.035, 0.16), 0xf7ead0, [0.3, 0.81, 0.05])
    part(g, ball(0.03), 0xffb347, [0.3, 0.92, 0.05], { emissive: 0xffa11f, emissiveIntensity: 1.4 })
  },
  obj_rose_pot(g) {
    part(g, cyl(0.18, 0.24, 0.35, 12), 0x2a1f26, [0, 0.18, 0])
    part(g, cyl(0.018, 0.018, 0.72, 8), 0x27733a, [0, 0.72, 0])
    const bloom = part(g, ball(0.16), 0xc32237, [0, 1.12, 0], { name: WELL_KNOWN_NODES.roseBloom, emissive: 0x6a0a1a, emissiveIntensity: 0.3 })
    bloom.scale.set(1, 0.8, 1)
    part(g, ball(0.27), 0xff77a6, [0, 1.12, 0], { opacity: 0.12, name: WELL_KNOWN_NODES.roseAura, emissive: 0xff77a6, emissiveIntensity: 1 })
  },
  obj_garden_window(g) {
    const frame = 0x3a2a30
    part(g, box(1.3, 0.07, 0.1), frame, [0, 0.55, 0])
    part(g, box(1.3, 0.07, 0.1), frame, [0, -0.55, 0])
    part(g, box(0.07, 1.17, 0.1), frame, [-0.62, 0, 0])
    part(g, box(0.07, 1.17, 0.1), frame, [0.62, 0, 0])
    part(g, box(0.04, 1.1, 0.06), frame, [0, 0, 0])
    part(g, box(1.2, 1.05, 0.02), 0x9ec3ff, [0, 0, -0.02], { opacity: 0.28, emissive: 0x6f8cff, emissiveIntensity: 0.4, name: 'window_glass' })
    part(g, box(1.45, 0.06, 0.3), 0x5c4036, [0, -0.62, 0.12]) // sill
    const anchor = new Group()
    anchor.name = WELL_KNOWN_NODES.gardenAnchor
    anchor.position.set(0, -0.52, 0.12)
    part(anchor, box(1.3, 0.14, 0.24), 0x6e3e22, [0, 0.07, 0]) // planter
    part(anchor, box(1.22, 0.02, 0.18), 0x3b2a1e, [0, 0.15, 0]) // soil
    g.add(anchor)
  },
  obj_date_jar(g) {
    part(g, box(0.7, 0.06, 0.5), 0x6e3e22, [0, 0.4, 0])
    legs(g, 0x4b2b19, 0.3, 0.2, 0.4, 0.07)
    part(g, cyl(0.17, 0.17, 0.34, 20), 0xbfe6ff, [0, 0.6, 0], { opacity: 0.35, roughness: 0.1 })
    part(g, cyl(0.15, 0.17, 0.05, 20), 0xb08a4a, [0, 0.8, 0])
    const colors = [0xff9fb8, 0xffe28a, 0xa8f0c0, 0xc9b8ff]
    colors.forEach((c, i) => part(g, box(0.1, 0.1, 0.01), c, [(i - 1.5) * 0.06, 0.5 + (i % 2) * 0.07, 0.02 * (i - 1.5)], { rotation: [0.2 * i, 0.5 * i, 0.3 * i] }))
  },
  obj_letter_desk(g) {
    part(g, box(0.62, 0.06, 1.0), 0x7a4f2d, [0, 0.72, 0])
    legs(g, 0x4b2b19, 0.26, 0.44, 0.72, 0.07)
    part(g, box(0.28, 0.01, 0.2), 0xfff3dc, [0.02, 0.76, 0.12], { rotation: [0, 0.2, 0] })
    part(g, box(0.1, 0.01, 0.1), 0xff7aaa, [0.02, 0.77, 0.12], { rotation: [0, 0.2, 0] })
    part(g, cyl(0.05, 0.07, 0.12), 0x3a2a30, [-0.12, 0.81, -0.3])
    g.rotation.y = Math.PI / 2
  },
  obj_wall_heart(g) {
    const shape = new Shape()
    shape.moveTo(0, -0.28)
    shape.bezierCurveTo(-0.5, 0.05, -0.34, 0.42, 0, 0.2)
    shape.bezierCurveTo(0.34, 0.42, 0.5, 0.05, 0, -0.28)
    const geometry = new ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 20 })
    part(g, geometry, 0xff5fb0, [0, 0, 0], { emissive: 0xff2f97, emissiveIntensity: 0.5, roughness: 0.4 })
  },
  obj_memory_shelf(g) {
    part(g, box(1.15, 0.05, 0.22), 0x6e3e22, [0, 0, 0])
    part(g, box(1.15, 0.05, 0.22), 0x6e3e22, [0, 0.5, 0])
    part(g, box(0.2, 0.26, 0.03), 0xffd98d, [-0.35, 0.18, 0], { rotation: [0, 0, 0.05] })
    part(g, box(0.16, 0.2, 0.03), 0xf4e4c1, [-0.05, 0.15, 0])
    part(g, box(0.07, 0.24, 0.14), 0x8a3b4f, [0.3, 0.14, 0])
    part(g, box(0.07, 0.2, 0.14), 0x3b5a8a, [0.38, 0.12, 0])
    part(g, box(0.24, 0.18, 0.03), 0xc9a7ff, [-0.3, 0.65, 0])
    g.rotation.y = Math.PI / 2
  },
  obj_mischief_box(g) {
    part(g, box(0.42, 0.3, 0.42), 0xff9fd0, [0, 0.15, 0])
    part(g, box(0.46, 0.08, 0.46), 0xffd1e6, [0, 0.34, 0])
    part(g, box(0.06, 0.32, 0.44), 0xffe28a, [0, 0.16, 0])
    part(g, box(0.44, 0.32, 0.06), 0xffe28a, [0, 0.16, 0])
    part(g, ball(0.06), 0xffe28a, [0, 0.42, 0])
    g.rotation.y = 0.5
  },
  obj_time_chest(g) {
    part(g, box(0.8, 0.36, 0.5), 0x5c3a24, [0, 0.18, 0])
    const lid = part(g, new CylinderGeometry(0.25, 0.25, 0.8, 16, 1, false, 0, Math.PI), 0x6e4a2e, [0, 0.36, 0], { rotation: [0, 0, Math.PI / 2] })
    lid.rotation.order = 'ZYX'
    lid.rotation.set(Math.PI / 2, 0, Math.PI / 2)
    part(g, box(0.06, 0.4, 0.52), 0xb08a4a, [-0.25, 0.2, 0])
    part(g, box(0.06, 0.4, 0.52), 0xb08a4a, [0.25, 0.2, 0])
    part(g, box(0.1, 0.1, 0.04), 0xd8c4a0, [0, 0.3, 0.27])
    g.rotation.y = 0.35
  },
  obj_ceiling_lamp(g) {
    part(g, cyl(0.014, 0.014, 0.28, 10), 0x5c4450, [0, 0.14, 0])
    part(g, cyl(0.06, 0.095, 0.05, 12), 0x7c5968, [0, 0.29, 0])
    const shade = part(g, new CylinderGeometry(0.16, 0.24, 0.2, 18, 1, true), 0xe8b58f, [0, 0.06, 0], { name: 'lamp_shade' })
    shade.material = new MeshStandardMaterial({ color: 0xe8b58f, roughness: 0.72, side: DoubleSide })
    shade.rotation.x = Math.PI
    part(g, ball(0.075), 0xffefcf, [0, -0.04, 0], { emissive: 0xffc979, emissiveIntensity: 0.06, name: 'lamp_bulb' })
    const halo = new Mesh(ball(0.14), new MeshBasicMaterial({ color: 0xffd79a, transparent: true, opacity: 0.018, depthWrite: false }))
    halo.name = 'lamp_halo'
    halo.position.set(0, -0.04, 0)
    g.add(halo)
  },
}

export function buildPlaceholderObject(definition: InteractionDefinition): Group | null {
  const build = BUILDERS[definition.id]
  if (!build) return null
  const group = new Group()
  group.name = definition.id
  group.userData.signal_id = definition.id
  group.userData.placeholder = true
  build(group)
  group.position.set(...definition.placeholderAt)
  return group
}

/** The whole placeholder house: shell plus one object per registry entry that has a builder. */
export function buildPlaceholderHouse(): Group {
  const house = new Group()
  house.name = 'placeholder_house'
  house.add(buildRoomShell())
  for (const definition of INTERACTIONS) {
    const object = buildPlaceholderObject(definition)
    if (object) house.add(object)
  }
  return house
}

export function hasPlaceholderFor(id: string): boolean {
  return id in BUILDERS
}

/** Disposes geometries, materials and textures under an object. */
export function disposeObject(root: Object3D): void {
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.dispose()
    const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      for (const value of Object.values(material)) if (value && typeof value === 'object' && 'isTexture' in value) (value as { dispose(): void }).dispose()
      material.dispose()
    }
  })
}
