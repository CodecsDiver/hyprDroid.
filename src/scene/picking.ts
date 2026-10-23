import { Box3, BoxGeometry, Mesh, MeshBasicMaterial, Vector3, type Camera, type Object3D, type Raycaster, type Vector2 } from 'three'

/**
 * Resolves which registry object a scene node belongs to.
 *
 * Tagging (glTF extras → `userData.signal_id`) wins over node names. Names are
 * matched exactly, or with the numeric suffix Blender/glTF add to duplicates
 * (`obj_guitar.001` is sanitised by three.js to `obj_guitar001`).
 */
export function matchObjectId(name: string, known: ReadonlySet<string>): string | null {
  if (known.has(name)) return name
  const stripped = name.replace(/[._]?\d{3}$/, '')
  return stripped !== name && known.has(stripped) ? stripped : null
}

export function interactionIdOf(object: Object3D, known: ReadonlySet<string>): string | null {
  let node: Object3D | null = object
  while (node) {
    const tag: unknown = node.userData?.signal_id
    if (typeof tag === 'string' && known.has(tag)) return tag
    const byName = matchObjectId(node.name, known)
    if (byName) return byName
    node = node.parent
  }
  return null
}

/** Finds the top-most node for each registry id inside a loaded scene. */
export function collectInteractiveRoots(scene: Object3D, known: ReadonlySet<string>): Map<string, Object3D> {
  const roots = new Map<string, Object3D>()
  scene.traverse((node) => {
    const tag: unknown = node.userData?.signal_id
    const id = typeof tag === 'string' && known.has(tag) ? tag : matchObjectId(node.name, known)
    if (id && !roots.has(id)) roots.set(id, node)
  })
  return roots
}

/**
 * Adds an invisible, slightly larger box so small objects stay easy to hit with a
 * finger. It is raycastable but never drawn.
 */
export function attachHitProxy(root: Object3D, padding = 1.25, minSize = 0.4): void {
  root.updateWorldMatrix(true, true)
  const bounds = new Box3().setFromObject(root)
  if (bounds.isEmpty()) return
  const size = bounds.getSize(new Vector3())
  const center = bounds.getCenter(new Vector3())
  const worldScale = root.getWorldScale(new Vector3())
  const local = root.worldToLocal(center.clone())
  const proxy = new Mesh(
    new BoxGeometry(
      Math.max(size.x * padding, minSize) / (worldScale.x || 1),
      Math.max(size.y * padding, minSize) / (worldScale.y || 1),
      Math.max(size.z * padding, minSize) / (worldScale.z || 1),
    ),
    new MeshBasicMaterial({ visible: false }),
  )
  proxy.name = 'hit_proxy'
  proxy.userData.hitProxy = true
  proxy.position.copy(local)
  root.add(proxy)
}

/**
 * Real geometry wins over padded hit proxies, so a tall object's generous hit
 * box can never steal a tap that lands on a neighbouring object's actual mesh.
 * Proxies only decide when the pointer is over empty space near an object.
 */
export function pickInteraction(raycaster: Raycaster, pointer: Vector2, camera: Camera, roots: ReadonlyMap<string, Object3D>): string | null {
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects([...roots.values()], true)
  const known = new Set(roots.keys())
  let proxyId: string | null = null
  for (const hit of hits) {
    const id = interactionIdOf(hit.object, known)
    if (!id) continue
    if (!hit.object.userData.hitProxy) return id
    proxyId ??= id
  }
  return proxyId
}
