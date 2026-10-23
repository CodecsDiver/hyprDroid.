/** Mischief catalogue. `disruptive` effects need a second, explicit opt-in from the recipient. */

export interface MischiefEffect {
  id: string
  label: string
  description: string
  emoji: string
  disruptive: boolean
  /** Longest an effect may stay on screen, in ms. Disruptive effects are always short. */
  durationMs: number
}

export const MISCHIEF_EFFECTS = [
  { id: 'confetti', label: 'Confetti', description: 'A small burst of confetti.', emoji: '🎉', disruptive: false, durationMs: 2500 },
  { id: 'sparkle_trail', label: 'Sparkle trail', description: 'Sparkles follow the cursor or finger.', emoji: '✨', disruptive: false, durationMs: 5000 },
  { id: 'tiny_ghost', label: 'Tiny ghost', description: 'A friendly ghost drifts across the room.', emoji: '👻', disruptive: false, durationMs: 4000 },
  { id: 'peekaboo_cat', label: 'Peekaboo cat', description: 'A cat peeks in from the edge of the screen.', emoji: '🐱', disruptive: false, durationMs: 3500 },
  { id: 'balloons', label: 'Balloons', description: 'Balloons float up from the floor.', emoji: '🎈', disruptive: false, durationMs: 4500 },
  { id: 'shake_room', label: 'Room shake', description: 'The whole room wobbles.', emoji: '🫨', disruptive: true, durationMs: 1800 },
  { id: 'flip_room', label: 'Upside-down room', description: 'The room flips for a moment.', emoji: '🙃', disruptive: true, durationMs: 2500 },
  { id: 'invert_colors', label: 'Colour swap', description: 'Colours invert briefly.', emoji: '🌀', disruptive: true, durationMs: 2000 },
  { id: 'fake_glitch', label: 'Fake glitch', description: 'A harmless pretend glitch.', emoji: '📺', disruptive: true, durationMs: 2000 },
] as const satisfies readonly MischiefEffect[]

export type MischiefEffectId = (typeof MISCHIEF_EFFECTS)[number]['id']
export const MISCHIEF_EFFECT_IDS = MISCHIEF_EFFECTS.map((effect) => effect.id) as readonly MischiefEffectId[]

export function mischiefEffect(id: string): (typeof MISCHIEF_EFFECTS)[number] | undefined {
  return MISCHIEF_EFFECTS.find((effect) => effect.id === id)
}

export interface MischiefConsent {
  allowMischief: boolean
  allowDisruptive: boolean
  /** Local "pause everything" switch. */
  paused: boolean
}

/** The recipient's device re-checks consent before playing anything (defence in depth). */
export function mayPlayMischief(effectId: string, consent: MischiefConsent): boolean {
  const effect = mischiefEffect(effectId)
  if (!effect || consent.paused || !consent.allowMischief) return false
  return !effect.disruptive || consent.allowDisruptive
}
