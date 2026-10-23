import { describe, expect, it } from 'vitest'
import { DEFAULT_MANIFEST, validateManifest, type AssetManifest } from '@/assets/manifest'
import { INTERACTIONS, INTERACTION_IDS, PANEL_IDS, WELL_KNOWN_NODES, getInteraction, interactionsInKeyboardOrder, noteTargets } from '@/registry/interactionRegistry'
import { OBJECT_ID_PATTERN } from '@/domain/validate'

describe('interaction registry', () => {
  it('has unique, database-compatible object ids and unique keyboard orders', () => {
    expect(new Set(INTERACTION_IDS).size).toBe(INTERACTIONS.length)
    for (const id of INTERACTION_IDS) expect(id).toMatch(OBJECT_ID_PATTERN) // hidden_notes.object_id CHECK
    expect(new Set(INTERACTIONS.map((i) => i.keyboardOrder)).size).toBe(INTERACTIONS.length)
  })

  it('binds every required feature panel exactly once', () => {
    const panels = INTERACTIONS.flatMap((i) => (i.behavior.type === 'panel' ? [i.behavior.panel] : []))
    expect(new Set(panels).size).toBe(panels.length)
    expect([...panels].sort()).toEqual([...PANEL_IDS].sort())
  })

  it('gives every object a usable camera preset and accessible text', () => {
    for (const i of INTERACTIONS) {
      expect(i.camera.zoom).toBeGreaterThan(0)
      expect(i.label.length).toBeGreaterThan(0)
      expect(i.description.length).toBeGreaterThan(10)
    }
  })

  it('looks up and orders objects', () => {
    expect(getInteraction('obj_guitar')?.behavior).toEqual({ type: 'panel', panel: 'listening' })
    expect(getInteraction('nope')).toBeUndefined()
    expect(interactionsInKeyboardOrder()[0]?.id).toBe('obj_rose_pot')
    expect(noteTargets().length).toBeGreaterThan(3)
  })

  it('does not collide well-known node names with object ids', () => {
    for (const name of Object.values(WELL_KNOWN_NODES)) expect(INTERACTION_IDS).not.toContain(name)
  })
})

describe('asset manifest', () => {
  it('ships valid, with every asset honestly unset (placeholders, not claimed art)', () => {
    expect(validateManifest(DEFAULT_MANIFEST, INTERACTION_IDS)).toEqual([])
    expect(DEFAULT_MANIFEST.models.house.source).toBeNull()
    expect(Object.values(DEFAULT_MANIFEST.sfx).every((a) => a.source === null)).toBe(true)
  })

  const with_ = (patch: Partial<AssetManifest>): AssetManifest => ({ ...DEFAULT_MANIFEST, ...patch })

  it('rejects path traversal and non-/assets public paths', () => {
    const issues = validateManifest(with_({ models: { house: { source: { kind: 'public', path: '/assets/../secret.glb' } }, objects: {} } }), INTERACTION_IDS)
    expect(issues).toHaveLength(1)
    expect(validateManifest(with_({ models: { house: { source: { kind: 'public', path: 'https://evil.example/x.glb' } }, objects: {} } }), INTERACTION_IDS)).toHaveLength(1)
    expect(validateManifest(with_({ models: { house: { source: { kind: 'private', fileId: 'not-a-uuid' } }, objects: {} } }), INTERACTION_IDS)).toHaveLength(1)
  })

  it('catches animation bindings and model overrides for unknown objects, and duplicates', () => {
    const binding = { clip: 'strum', objectId: 'obj_guitar', trigger: 'select', loop: false } as const
    expect(validateManifest(with_({ animations: [binding, binding] }), INTERACTION_IDS)).toHaveLength(1)
    expect(validateManifest(with_({ animations: [{ ...binding, objectId: 'obj_nope' }] }), INTERACTION_IDS)).toHaveLength(1)
    expect(validateManifest(with_({ models: { house: { source: null }, objects: { obj_nope: { source: null } } } }), INTERACTION_IDS)).toHaveLength(1)
  })

  it('validates volumes, scale and image alt text', () => {
    expect(validateManifest(with_({ sfx: { ...DEFAULT_MANIFEST.sfx, ui: { source: null, volume: 3 } } }), INTERACTION_IDS)).toHaveLength(1)
    expect(validateManifest(with_({ models: { house: { source: null, scale: 0 }, objects: {} } }), INTERACTION_IDS)).toHaveLength(1)
    expect(validateManifest(with_({ images: { logo: { source: { kind: 'public', path: '/assets/logo.png' }, alt: ' ' } } }), INTERACTION_IDS)).toHaveLength(1)
  })
})
