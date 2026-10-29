/**
 * Declarative interaction registry.
 *
 * This is the ONLY place that connects a stable Blender object identifier to
 * an application behaviour. The 3D layer knows nothing about features: it
 * finds nodes named (or tagged) with these ids and reports a selection.
 * Replacing the placeholder scene with a real Blender export therefore needs
 * no code change as long as the node names below are kept — see
 * docs/ASSET_SPEC.md for the naming contract.
 *
 * To add an interactive object: add an entry here, name the Blender node with
 * the same `id`. To rebind an object to another feature: change `behavior`.
 */

export const PANEL_IDS = [
  'love-ping', 'listening', 'garden', 'date-jar', 'hidden-notes', 'mischief', 'spell-table', 'love-universe', 'vault', 'time-capsule',
  'calendar', 'daily', 'postcards',
] as const
export type PanelId = (typeof PANEL_IDS)[number]

export type DirectAction = 'toggle_lamp'

export type Behavior = { type: 'panel'; panel: PanelId } | { type: 'action'; action: DirectAction }

export interface CameraPreset {
  /** World-space point the camera looks at. */
  target: readonly [number, number, number]
  /** Orthographic zoom (1 = whole room). */
  zoom: number
}

export interface InteractionDefinition {
  /** Stable Blender object identifier (node name or glTF extras `signal_id`). */
  readonly id: string
  readonly label: string
  readonly description: string
  readonly behavior: Behavior
  readonly camera: CameraPreset
  /** Emissive highlight colour (0xRRGGBB). */
  readonly highlight: number
  /** Hidden notes may be pinned to this object. */
  readonly noteTarget: boolean
  /** Tab / list order for keyboard and screen-reader navigation. */
  readonly keyboardOrder: number
  /** Sound effect id from the asset manifest played on selection. */
  readonly sfx: string
  /** Where the placeholder builder puts this object (world units). Real assets ignore it. */
  readonly placeholderAt: readonly [number, number, number]
}

export const INTERACTIONS = [
  {
    id: 'obj_rose_pot', label: 'Rose', description: 'Send a love ping. The rose grows with every bit of affection.',
    behavior: { type: 'panel', panel: 'love-ping' }, camera: { target: [1.55, 0.7, 0.55], zoom: 2.1 }, highlight: 0xff77a6,
    noteTarget: true, keyboardOrder: 1, sfx: 'rose', placeholderAt: [1.55, 0, 0.55],
  },
  {
    id: 'obj_guitar', label: 'Guitar', description: 'Listen together: songs, playlists and synchronised playback.',
    behavior: { type: 'panel', panel: 'listening' }, camera: { target: [-1.55, 0.9, -0.8], zoom: 2.0 }, highlight: 0xffd37a,
    noteTarget: true, keyboardOrder: 2, sfx: 'guitar', placeholderAt: [-1.55, 0, -0.8],
  },
  {
    id: 'obj_garden_window', label: 'Garden window', description: 'The mood garden you grow together.',
    behavior: { type: 'panel', panel: 'garden' }, camera: { target: [1.35, 1.3, -1.6], zoom: 2.0 }, highlight: 0x9be8a8,
    noteTarget: false, keyboardOrder: 3, sfx: 'zoom', placeholderAt: [1.35, 1.35, -1.66],
  },
  {
    id: 'obj_date_jar', label: 'Date jar', description: 'Draw a date idea, keep favourites, remember the ones you did.',
    behavior: { type: 'panel', panel: 'date-jar' }, camera: { target: [-0.5, 0.65, 0.85], zoom: 2.4 }, highlight: 0xffe28a,
    noteTarget: true, keyboardOrder: 4, sfx: 'glass', placeholderAt: [-0.5, 0, 0.85],
  },
  {
    id: 'obj_letter_desk', label: 'Letter desk', description: 'Hidden notes waiting for you, and notes you have hidden.',
    behavior: { type: 'panel', panel: 'hidden-notes' }, camera: { target: [-2.0, 0.8, 0.35], zoom: 2.0 }, highlight: 0xf4e4c1,
    noteTarget: true, keyboardOrder: 5, sfx: 'open', placeholderAt: [-2.0, 0, 0.35],
  },
  {
    id: 'obj_spell_table', label: "Vee's spell table", description: 'Brew spells, save recipes and cast something sweet.',
    behavior: { type: 'panel', panel: 'spell-table' }, camera: { target: [0.35, 0.8, -0.75], zoom: 2.0 }, highlight: 0xc9a7ff,
    noteTarget: true, keyboardOrder: 6, sfx: 'glass', placeholderAt: [0.35, 0, -0.75],
  },
  {
    id: 'obj_wall_heart', label: 'Heart', description: 'The Love Universe: tap the heart for a note, a hug and a sticker.',
    behavior: { type: 'panel', panel: 'love-universe' }, camera: { target: [-0.5, 1.7, -1.6], zoom: 2.2 }, highlight: 0xff5fb0,
    noteTarget: true, keyboardOrder: 7, sfx: 'love', placeholderAt: [-0.5, 1.7, -1.66],
  },
  {
    id: 'obj_memory_shelf', label: 'Memory shelf', description: 'Photos, voice messages and milestones you keep.',
    behavior: { type: 'panel', panel: 'vault' }, camera: { target: [-2.1, 1.4, -0.9], zoom: 2.0 }, highlight: 0xffd98d,
    noteTarget: true, keyboardOrder: 8, sfx: 'open', placeholderAt: [-2.15, 1.35, -0.9],
  },
  {
    id: 'obj_mischief_box', label: 'Mischief box', description: 'Playful surprises. Everything here is opt-in.',
    behavior: { type: 'panel', panel: 'mischief' }, camera: { target: [0.7, 0.3, 1.0], zoom: 2.4 }, highlight: 0xff9fd0,
    noteTarget: true, keyboardOrder: 9, sfx: 'pop', placeholderAt: [0.7, 0, 1.0],
  },
  {
    id: 'obj_time_chest', label: 'Time capsule', description: 'The original Signal Home and Love Universe, kept exactly as they were.',
    behavior: { type: 'panel', panel: 'time-capsule' }, camera: { target: [-1.7, 0.3, 1.0], zoom: 2.2 }, highlight: 0xd8c4a0,
    noteTarget: false, keyboardOrder: 10, sfx: 'bong', placeholderAt: [-1.7, 0, 1.0],
  },
  {
    id: 'obj_ceiling_lamp', label: 'Ceiling lamp', description: 'Switch the room light on or off.',
    behavior: { type: 'action', action: 'toggle_lamp' }, camera: { target: [0, 1.9, -0.1], zoom: 1.5 }, highlight: 0xffcc8d,
    noteTarget: false, keyboardOrder: 11, sfx: 'toggle', placeholderAt: [0, 2.08, -0.1],
  },
  {
    id: 'obj_calendar', label: 'Calendar', description: 'Anniversaries, birthdays and countdowns you are both looking forward to.',
    behavior: { type: 'panel', panel: 'calendar' }, camera: { target: [0.3, 1.45, -1.6], zoom: 2.4 }, highlight: 0xffb4c9,
    noteTarget: true, keyboardOrder: 12, sfx: 'open', placeholderAt: [0.3, 1.45, -1.66],
  },
  {
    id: 'obj_chalkboard', label: 'Question board', description: 'One question a day. Answers stay secret until you have both answered.',
    behavior: { type: 'panel', panel: 'daily' }, camera: { target: [-2.0, 1.3, 1.05], zoom: 2.1 }, highlight: 0xbfe8c8,
    noteTarget: true, keyboardOrder: 13, sfx: 'select', placeholderAt: [-2.25, 1.3, 1.05],
  },
  {
    id: 'obj_postbox', label: 'Postbox', description: 'Postcards: send a message as a code or link, and open the ones you receive.',
    behavior: { type: 'panel', panel: 'postcards' }, camera: { target: [1.95, 0.6, -0.95], zoom: 2.3 }, highlight: 0xff8c8c,
    noteTarget: true, keyboardOrder: 14, sfx: 'pop', placeholderAt: [1.95, 0, -0.95],
  },
] as const satisfies readonly InteractionDefinition[]

export type ObjectId = (typeof INTERACTIONS)[number]['id']

export const INTERACTION_IDS: readonly string[] = INTERACTIONS.map((definition) => definition.id)

const BY_ID: ReadonlyMap<string, InteractionDefinition> = new Map(INTERACTIONS.map((definition) => [definition.id, definition]))

export function getInteraction(id: string): InteractionDefinition | undefined {
  return BY_ID.get(id)
}

export function interactionsInKeyboardOrder(): readonly InteractionDefinition[] {
  return [...INTERACTIONS].sort((a, b) => a.keyboardOrder - b.keyboardOrder)
}

export function noteTargets(): readonly InteractionDefinition[] {
  return interactionsInKeyboardOrder().filter((definition) => definition.noteTarget)
}

/** Optional well-known child nodes the scene drives if present in a replacement asset. */
export const WELL_KNOWN_NODES = {
  roseBloom: 'rose_bloom',
  roseAura: 'rose_aura',
  gardenAnchor: 'garden_anchor',
  lampLight: 'lamp_light',
} as const
