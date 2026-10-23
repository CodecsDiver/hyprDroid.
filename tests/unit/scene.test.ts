import { Group, Mesh, MeshStandardMaterial, BoxGeometry, Raycaster, Vector2, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_MANIFEST, createAssetResolver, type AssetManifest } from '@/assets/manifest'
import { CameraRig } from '@/scene/cameraRig'
import { HighlightController } from '@/scene/highlight'
import { applyTextureOverrides, buildHouse } from '@/scene/loader'
import { attachHitProxy, collectInteractiveRoots, interactionIdOf, matchObjectId, pickInteraction } from '@/scene/picking'
import { buildPlaceholderHouse, hasPlaceholderFor } from '@/scene/placeholders'
import { INTERACTIONS, INTERACTION_IDS } from '@/registry/interactionRegistry'

const known = new Set(INTERACTION_IDS)
const resolver = createAssetResolver(async () => 'http://127.0.0.1:1/never')

describe('placeholder scene honours the registry contract', () => {
  it('provides a correctly named, tagged node for every registry id', () => {
    const house = buildPlaceholderHouse()
    const roots = collectInteractiveRoots(house, known)
    expect([...roots.keys()].sort()).toEqual([...INTERACTION_IDS].sort())
    for (const root of roots.values()) expect(root.userData.placeholder).toBe(true)
    for (const id of INTERACTION_IDS) expect(hasPlaceholderFor(id)).toBe(true)
  })

  it('assembles entirely from placeholders when the manifest has no assets', async () => {
    const build = await buildHouse(DEFAULT_MANIFEST, resolver)
    expect(build.fromAsset).toBe(false)
    expect(build.missing).toEqual([])
    expect(build.placeholders.sort()).toEqual([...INTERACTION_IDS].sort())
    expect(build.warnings).toEqual([])
  })

  it('degrades to a placeholder, with a warning, when a replacement GLB cannot be loaded', async () => {
    const manifest: AssetManifest = {
      ...DEFAULT_MANIFEST,
      models: { house: { source: null }, objects: { obj_guitar: { source: { kind: 'public', path: '/assets/3d/guitar.glb' } } } },
    }
    const build = await buildHouse(manifest, resolver)
    expect(build.placeholders).toContain('obj_guitar')
    expect(build.warnings.some((w) => w.includes('obj_guitar'))).toBe(true)
    expect(build.roots.has('obj_guitar')).toBe(true)
  })

  it('does not leave unselectable objects: every root gets a hit proxy', async () => {
    const build = await buildHouse(DEFAULT_MANIFEST, resolver)
    for (const root of build.roots.values()) expect(root.children.some((c) => c.userData.hitProxy)).toBe(true)
  })
})

describe('manifest texture overrides', () => {
  it('names the placeholder shell meshes so textures can target them', async () => {
    const build = await buildHouse(DEFAULT_MANIFEST, resolver)
    for (const name of ['floor', 'wall_back', 'wall_left', 'rug']) expect(build.root.getObjectByName(name), name).toBeTruthy()
  })

  it('reports a missing target or a failing texture instead of throwing', async () => {
    const build = await buildHouse(DEFAULT_MANIFEST, resolver)
    const warnings: string[] = []
    const manifest: AssetManifest = {
      ...DEFAULT_MANIFEST,
      textures: {
        nope: { source: { kind: 'public', path: '/assets/tex/nope.png' }, colorSpace: 'srgb' },
        floor: { source: { kind: 'public', path: '/assets/tex/floor.png' }, colorSpace: 'srgb' },
      },
    }
    await applyTextureOverrides(build.root, manifest, resolver, warnings)
    expect(warnings.some((w) => w.includes('"nope"'))).toBe(true)
    expect(warnings.some((w) => w.includes('"floor" failed'))).toBe(true)
  })
})

describe('resolving interaction ids', () => {
  it('walks up from a child mesh to the tagged or named object', () => {
    const root = new Group()
    root.name = 'obj_guitar'
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
    root.add(mesh)
    expect(interactionIdOf(mesh, known)).toBe('obj_guitar')

    const tagged = new Group()
    tagged.name = 'Cube.012'
    tagged.userData.signal_id = 'obj_date_jar'
    const child = new Mesh()
    tagged.add(child)
    expect(interactionIdOf(child, known)).toBe('obj_date_jar')
    expect(interactionIdOf(new Mesh(), known)).toBeNull()
  })

  it('accepts the suffixes Blender and glTF add to duplicated objects', () => {
    expect(matchObjectId('obj_guitar', known)).toBe('obj_guitar')
    expect(matchObjectId('obj_guitar001', known)).toBe('obj_guitar')
    expect(matchObjectId('obj_guitar.001', known)).toBe('obj_guitar')
    expect(matchObjectId('obj_guitar_case', known)).toBeNull()
    expect(matchObjectId('Cube', known)).toBeNull()
  })

  it('ignores tags that are not registered ids', () => {
    const node = new Group()
    node.userData.signal_id = 'obj_unknown'
    expect(interactionIdOf(node, known)).toBeNull()
  })
})

describe('raycast picking', () => {
  it('selects the object under the pointer and nothing in empty space', async () => {
    const build = await buildHouse(DEFAULT_MANIFEST, resolver)
    const rig = new CameraRig(() => true)
    rig.setViewport(800, 600)
    rig.camera.updateMatrixWorld(true)
    const raycaster = new Raycaster()

    for (const definition of INTERACTIONS) {
      const root = build.roots.get(definition.id)!
      const proxy = root.children.find((c) => c.userData.hitProxy)!
      const worldCenter = proxy.getWorldPosition(new Vector3())
      const ndc = worldCenter.clone().project(rig.camera)
      const picked = pickInteraction(raycaster, new Vector2(ndc.x, ndc.y), rig.camera, build.roots)
      expect(picked, `pointer on ${definition.id}`).toBe(definition.id)
    }
    expect(pickInteraction(raycaster, new Vector2(0.99, 0.99), rig.camera, build.roots)).toBeNull()
  })
})

describe('highlighting', () => {
  it('never tints objects that merely share a material', () => {
    const shared = new MeshStandardMaterial({ color: 0xffffff })
    const a = new Group(); a.add(new Mesh(new BoxGeometry(), shared))
    const b = new Group(); b.add(new Mesh(new BoxGeometry(), shared))
    const controller = new HighlightController(new Map([['a', a], ['b', b]]), new Map([['a', 0xff0000], ['b', 0x00ff00]]))
    controller.set('a', 'selected')
    for (let i = 0; i < 40; i++) controller.update(i / 10, 0.1, true)
    const materialA = (a.children[0] as Mesh).material as MeshStandardMaterial
    const materialB = (b.children[0] as Mesh).material as MeshStandardMaterial
    expect(materialA.emissive.r).toBeGreaterThan(0.3)
    expect(materialB.emissive.getHex()).toBe(0)
    expect(shared.emissive.getHex()).toBe(0)
    controller.dispose()
  })
})

describe('camera rig', () => {
  it('moves instantly under reduced motion and animates otherwise', () => {
    const reduced = new CameraRig(() => true)
    reduced.focus({ target: [1, 1, 1], zoom: 2 })
    expect(reduced.camera.zoom).toBe(2)

    const smooth = new CameraRig(() => false)
    smooth.focus({ target: [1, 1, 1], zoom: 2 })
    expect(smooth.camera.zoom).toBe(1)
    smooth.update(0.1)
    expect(smooth.camera.zoom).toBeGreaterThan(1)
    expect(smooth.camera.zoom).toBeLessThan(2)
    for (let i = 0; i < 100; i++) smooth.update(0.1)
    expect(smooth.camera.zoom).toBeCloseTo(2, 2)
  })

  it('clamps zoom and orbit so the room cannot be lost', () => {
    const rig = new CameraRig(() => true)
    rig.zoomBy(1000)
    expect(rig.camera.zoom).toBeLessThanOrEqual(3.2)
    rig.zoomBy(0.0001)
    expect(rig.camera.zoom).toBeGreaterThanOrEqual(0.8)
    rig.orbit(100)
    const position = rig.camera.position.clone()
    rig.orbit(100)
    expect(rig.camera.position.distanceTo(position)).toBeLessThan(1e-6)
  })

  it('widens the frustum on portrait screens so the room stays in frame', () => {
    const rig = new CameraRig(() => true)
    rig.setViewport(400, 800)
    const portraitWidth = rig.camera.right - rig.camera.left
    rig.setViewport(800, 400)
    expect(portraitWidth).toBeGreaterThan(rig.camera.top - rig.camera.bottom - 1) // not squeezed
  })

  it('returns to the whole room when focus is cleared', () => {
    const rig = new CameraRig(() => true)
    rig.focus({ target: [1, 1, 1], zoom: 2 })
    expect(rig.isFocused).toBe(true)
    rig.focus(null)
    expect(rig.isFocused).toBe(false)
    expect(rig.camera.zoom).toBe(1)
  })
})

describe('panel inset', () => {
  it('shifts the picture only while a panel is open, instantly under reduced motion', () => {
    const rig = new CameraRig(() => true)
    rig.setViewport(1000, 600)
    expect(rig.camera.view).toBeNull()
    rig.setPanelInset({ x: 215, y: 0 })
    expect(rig.camera.view?.enabled).toBe(true)
    expect(rig.camera.view?.offsetX).toBe(215)
    rig.setPanelInset({ x: 0, y: 0 })
    expect(rig.camera.view === null || rig.camera.view.enabled === false).toBe(true)
  })
})

describe('hit proxies', () => {
  it('pad small objects so they stay easy to tap', () => {
    const root = new Group()
    root.add(new Mesh(new BoxGeometry(0.1, 0.1, 0.1), new MeshStandardMaterial()))
    root.updateMatrixWorld(true)
    attachHitProxy(root)
    const proxy = root.children.find((c) => c.userData.hitProxy) as Mesh
    const box = (proxy.geometry as BoxGeometry).parameters
    expect(box.width).toBeGreaterThanOrEqual(0.4)
  })
})
