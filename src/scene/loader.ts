import { AnimationMixer, LoopOnce, LoopRepeat, Group, type AnimationAction, type AnimationClip, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { AnimationBinding, AssetManifest, AssetResolver, ModelAsset } from '@/assets/manifest'
import { INTERACTIONS, type InteractionDefinition } from '@/registry/interactionRegistry'
import { attachHitProxy, collectInteractiveRoots } from './picking'
import { buildPlaceholderObject, buildRoomShell } from './placeholders'

export interface HouseBuild {
  root: Group
  /** Interactive nodes by registry id. */
  roots: Map<string, Object3D>
  animations: AnimationClip[]
  /** Registry ids drawn from procedural placeholders. */
  placeholders: string[]
  /** Registry ids with neither an asset node nor a placeholder (cannot be selected). */
  missing: string[]
  /** True when a real house GLB was loaded. */
  fromAsset: boolean
  warnings: string[]
}

async function loadGltf(url: string, model: ModelAsset) {
  const loader = new GLTFLoader()
  if (model.draco) {
    const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js')
    const draco = new DRACOLoader()
    draco.setDecoderPath('/draco/')
    loader.setDRACOLoader(draco)
  }
  return loader.loadAsync(url)
}

function applyTransform(object: Object3D, model: ModelAsset): void {
  if (model.scale) object.scale.multiplyScalar(model.scale)
  if (model.offset) object.position.add({ x: model.offset[0], y: model.offset[1], z: model.offset[2] } as never)
  if (model.rotationY) object.rotation.y += model.rotationY
}

/**
 * Assembles the house from the manifest:
 *   1. a whole-room GLB if provided (nodes named with registry ids become interactive);
 *   2. per-object GLBs for any registry id the house does not contain;
 *   3. procedural placeholders for whatever is still missing.
 * A failure to load any GLB degrades to placeholders; it never blocks the app.
 */
export async function buildHouse(manifest: AssetManifest, resolver: AssetResolver, definitions: readonly InteractionDefinition[] = INTERACTIONS): Promise<HouseBuild> {
  const root = new Group()
  root.name = 'house'
  const warnings: string[] = []
  const known = new Set(definitions.map((d) => d.id))
  let animations: AnimationClip[] = []
  let fromAsset = false
  let roots = new Map<string, Object3D>()

  const houseUrl = await resolver.url(manifest.models.house.source).catch((error: unknown) => {
    warnings.push(`house url: ${String(error)}`)
    return null
  })
  if (houseUrl) {
    try {
      const gltf = await loadGltf(houseUrl, manifest.models.house)
      applyTransform(gltf.scene, manifest.models.house)
      root.add(gltf.scene)
      animations = gltf.animations
      fromAsset = true
      roots = collectInteractiveRoots(gltf.scene, known)
    } catch (error) {
      warnings.push(`house GLB failed to load, using placeholders: ${String(error)}`)
    }
  }
  if (!fromAsset) root.add(buildRoomShell())

  const placeholders: string[] = []
  const missing: string[] = []
  for (const definition of definitions) {
    if (roots.has(definition.id)) continue
    let object: Object3D | null = null

    const override = manifest.models.objects[definition.id]
    const url = override ? await resolver.url(override.source).catch(() => null) : null
    if (url && override) {
      try {
        const gltf = await loadGltf(url, override)
        object = new Group()
        object.add(gltf.scene)
        object.name = definition.id
        object.userData.signal_id = definition.id
        object.position.set(...definition.placeholderAt)
        applyTransform(object, override)
        animations = animations.concat(gltf.animations)
      } catch (error) {
        warnings.push(`${definition.id} GLB failed to load, using placeholder: ${String(error)}`)
      }
    }
    if (!object) {
      object = buildPlaceholderObject(definition)
      if (object) placeholders.push(definition.id)
    }
    if (object) {
      root.add(object)
      roots.set(definition.id, object)
    } else missing.push(definition.id)
  }

  root.updateMatrixWorld(true)
  for (const node of roots.values()) attachHitProxy(node)
  return { root, roots, animations, placeholders, missing, fromAsset, warnings }
}

/** Plays manifest-bound animation clips on triggers. A no-op when there are none. */
export class AnimationDirector {
  private readonly mixer: AnimationMixer
  private readonly actions = new Map<string, AnimationAction>()
  private readonly bindings: AnimationBinding[]
  readonly hasAnimations: boolean

  constructor(root: Object3D, clips: readonly AnimationClip[], bindings: readonly AnimationBinding[]) {
    this.mixer = new AnimationMixer(root)
    this.bindings = bindings.filter((binding) => clips.some((clip) => clip.name === binding.clip))
    for (const binding of this.bindings) {
      const clip = clips.find((candidate) => candidate.name === binding.clip)
      if (!clip) continue
      const action = this.mixer.clipAction(clip)
      action.setLoop(binding.loop ? LoopRepeat : LoopOnce, binding.loop ? Infinity : 1)
      action.clampWhenFinished = !binding.loop
      this.actions.set(this.key(binding), action)
      if (binding.trigger === 'idle') action.play()
    }
    this.hasAnimations = this.bindings.length > 0
  }

  private key(binding: AnimationBinding): string {
    return `${binding.objectId}|${binding.trigger}|${binding.clip}`
  }

  /** One-shot triggers (`select`). */
  fire(objectId: string, trigger: 'select'): void {
    for (const binding of this.bindings) if (binding.objectId === objectId && binding.trigger === trigger) this.actions.get(this.key(binding))?.reset().play()
  }

  /** State triggers (`hover`, `unread-note`) that loop while true. */
  setActive(objectId: string, trigger: 'hover' | 'unread-note', on: boolean): void {
    for (const binding of this.bindings) {
      if (binding.objectId !== objectId || binding.trigger !== trigger) continue
      const action = this.actions.get(this.key(binding))
      if (!action) continue
      if (on && !action.isRunning()) action.reset().fadeIn(0.2).play()
      if (!on && action.isRunning()) action.fadeOut(0.3)
    }
  }

  update(delta: number): boolean {
    if (!this.hasAnimations) return false
    this.mixer.update(delta)
    return true
  }

  dispose(): void {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.mixer.getRoot())
  }
}
