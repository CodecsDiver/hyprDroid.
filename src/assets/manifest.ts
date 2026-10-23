/**
 * Asset manifest: the single list of every replaceable asset.
 *
 * Nothing here is final artwork. Every `source: null` means "not provided yet":
 * the app falls back to procedural placeholders (3D) or synthesised sounds
 * (audio). Fill a source in and the matching asset is used — no code changes.
 *
 * Sources:
 *   { kind: 'public',  path: '/assets/...' }   shipped with the app. ONLY for
 *                                               assets that are safe to be public.
 *   { kind: 'private', fileId }                a file stored on the server (see POST /api/files),
 *                                               served only to the two signed-in people.
 *                                               Use this for anything personal.
 */

import type { AmbientId } from '@/domain/environment'

export type AssetSource =
  | { kind: 'public'; path: string }
  | { kind: 'private'; fileId: string }

export interface ModelAsset {
  source: AssetSource | null
  /** Uniform scale applied after load (Blender export scale mismatches). */
  scale?: number
  offset?: readonly [number, number, number]
  rotationY?: number
  /** Set when the GLB is Draco-compressed (decoder files must be served from /draco/). */
  draco?: boolean
}

export type AnimationTrigger = 'idle' | 'select' | 'hover' | 'unread-note'

export interface AnimationBinding {
  /** Exact animation clip name inside the GLB. */
  clip: string
  /** Registry object id the clip belongs to. */
  objectId: string
  trigger: AnimationTrigger
  loop: boolean
}

export interface AudioAsset {
  source: AssetSource | null
  volume: number
}

export interface TextureAsset {
  source: AssetSource | null
  colorSpace: 'srgb' | 'linear'
}

export interface ImageAsset {
  source: AssetSource | null
  alt: string
}

export const SFX_IDS = [
  'ui', 'nav', 'open', 'close', 'select', 'confirm', 'love', 'pop', 'guitar', 'glass', 'rose', 'zoom', 'rotate', 'snap', 'toggle', 'stage',
] as const
export type SfxId = (typeof SFX_IDS)[number]

export interface AssetManifest {
  version: 1
  models: {
    /** A whole-room GLB. Nodes named with registry ids become interactive. */
    house: ModelAsset
    /** Per-object GLBs that replace individual placeholders (placed at the registry's placeholder position). */
    objects: Record<string, ModelAsset>
  }
  animations: AnimationBinding[]
  sfx: Record<SfxId, AudioAsset>
  music: { ambient: Record<AmbientId, AudioAsset> }
  textures: Record<string, TextureAsset>
  images: Record<string, ImageAsset>
}

const none = (volume: number): AudioAsset => ({ source: null, volume })

export const DEFAULT_MANIFEST: AssetManifest = {
  version: 1,
  models: { house: { source: null }, objects: {} },
  animations: [],
  // Synthesised fallbacks play for every sfx whose source is null (src/audio/synth.ts).
  sfx: Object.fromEntries(SFX_IDS.map((id) => [id, none(id === 'rotate' || id === 'zoom' ? 0.16 : 0.3)])) as Record<SfxId, AudioAsset>,
  // The original mood loops (rain, gentle, sleep, reunion, cuddly) were separate audio files that
  // were not part of the supplied sources. Provide them here (a private server file is recommended).
  music: {
    ambient: {
      rain: none(0.24), gentle: none(0.34), sleep: none(0.32), reunion: none(0.34), cuddly: none(0.33),
    },
  },
  textures: {},
  images: {},
}

export interface ManifestIssue {
  path: string
  message: string
}

function checkSource(source: AssetSource | null, path: string, issues: ManifestIssue[]): void {
  if (source === null) return
  if (source.kind === 'public') {
    if (!source.path.startsWith('/assets/') || source.path.includes('..') || /^\/assets\/.*\/\//.test(source.path)) {
      issues.push({ path, message: 'public paths must live under /assets/ and may not contain ".."' })
    }
  } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(source.fileId)) {
    issues.push({ path, message: 'private sources need a file id (uuid) from the server' })
  }
}

/** Static validation used by tests and at start-up (issues are logged, never fatal). */
export function validateManifest(manifest: AssetManifest, objectIds: readonly string[]): ManifestIssue[] {
  const issues: ManifestIssue[] = []
  const known = new Set(objectIds)

  checkSource(manifest.models.house.source, 'models.house', issues)
  if ((manifest.models.house.scale ?? 1) <= 0) issues.push({ path: 'models.house.scale', message: 'scale must be positive' })
  for (const [id, model] of Object.entries(manifest.models.objects)) {
    if (!known.has(id)) issues.push({ path: `models.objects.${id}`, message: 'unknown object id (not in the interaction registry)' })
    checkSource(model.source, `models.objects.${id}`, issues)
    if ((model.scale ?? 1) <= 0) issues.push({ path: `models.objects.${id}.scale`, message: 'scale must be positive' })
  }

  const seen = new Set<string>()
  manifest.animations.forEach((binding, index) => {
    const path = `animations[${index}]`
    if (!known.has(binding.objectId)) issues.push({ path, message: `unknown object id "${binding.objectId}"` })
    if (!binding.clip) issues.push({ path, message: 'clip name is required' })
    const key = `${binding.objectId}|${binding.trigger}|${binding.clip}`
    if (seen.has(key)) issues.push({ path, message: 'duplicate binding' })
    seen.add(key)
  })

  const audio: [string, AudioAsset][] = [
    ...Object.entries(manifest.sfx).map(([id, asset]): [string, AudioAsset] => [`sfx.${id}`, asset]),
    ...Object.entries(manifest.music.ambient).map(([id, asset]): [string, AudioAsset] => [`music.ambient.${id}`, asset]),
  ]
  for (const [path, asset] of audio) {
    checkSource(asset.source, path, issues)
    if (!(asset.volume >= 0 && asset.volume <= 1)) issues.push({ path, message: 'volume must be between 0 and 1' })
  }
  for (const [id, texture] of Object.entries(manifest.textures)) checkSource(texture.source, `textures.${id}`, issues)
  for (const [id, image] of Object.entries(manifest.images)) {
    checkSource(image.source, `images.${id}`, issues)
    if (image.source && !image.alt.trim()) issues.push({ path: `images.${id}`, message: 'images need alt text' })
  }
  return issues
}

export type PrivateUrlFn = (fileId: string) => string | Promise<string>

export interface AssetResolver {
  /** URL to fetch the asset from, or null when the manifest has no source for it. */
  url(source: AssetSource | null): Promise<string | null>
}

export function createAssetResolver(privateUrl: PrivateUrlFn, base = '/'): AssetResolver {
  return {
    async url(source) {
      if (!source) return null
      if (source.kind === 'public') return base.replace(/\/$/, '') + source.path
      return privateUrl(source.fileId)
    },
  }
}
