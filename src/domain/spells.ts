/** Vee's Spell Table: effect catalogue, ingredient shelf, recipe helpers. */

import { cleanText, isHexColor, ValidationError } from './validate'

export interface SpellEffect {
  id: string
  label: string
  description: string
  emoji: string
}

export const SPELL_EFFECTS = [
  { id: 'sparkle_burst', label: 'Sparkle burst', description: 'A shimmer of tiny stars.', emoji: '✨' },
  { id: 'petal_rain', label: 'Petal rain', description: 'Soft petals drift down.', emoji: '🌸' },
  { id: 'moon_glow', label: 'Moon glow', description: 'A calm silver glow.', emoji: '🌙' },
  { id: 'starfall', label: 'Starfall', description: 'Shooting stars cross the room.', emoji: '🌠' },
  { id: 'heart_swirl', label: 'Heart swirl', description: 'Hearts spiral upward.', emoji: '💞' },
  { id: 'ember_drift', label: 'Ember drift', description: 'Warm embers float by.', emoji: '🔥' },
] as const satisfies readonly SpellEffect[]

export type SpellEffectId = (typeof SPELL_EFFECTS)[number]['id']
export const SPELL_EFFECT_IDS = SPELL_EFFECTS.map((effect) => effect.id) as readonly SpellEffectId[]

export function spellEffect(id: string): (typeof SPELL_EFFECTS)[number] | undefined {
  return SPELL_EFFECTS.find((effect) => effect.id === id)
}

/** Starting shelf; people can also type their own ingredients. */
export const STARTER_INGREDIENTS = [
  'moonlight', 'honey', 'lavender', 'rose petal', 'stardust', 'cinnamon', 'fireflies', 'vanilla',
  'a stolen kiss', 'warm blanket', 'giggles', 'chamomile',
] as const

export const MAX_INGREDIENTS = 8

export interface SpellRecipeInput {
  name: string
  ingredients: string[]
  effect: SpellEffectId
  message: string
  color: string
}

export function validateRecipe(input: Partial<Record<keyof SpellRecipeInput, unknown>>): SpellRecipeInput {
  const name = cleanText(input.name, 'name', { max: 40, required: true })
  const rawIngredients = Array.isArray(input.ingredients) ? input.ingredients : []
  if (rawIngredients.length > MAX_INGREDIENTS) throw new ValidationError('ingredients', `At most ${MAX_INGREDIENTS} ingredients`)
  const ingredients = rawIngredients.map((item) => cleanText(item, 'ingredient', { max: 30, required: true }))
  const effect = spellEffect(String(input.effect))
  if (!effect) throw new ValidationError('effect', 'Choose an effect')
  const color = typeof input.color === 'string' && isHexColor(input.color) ? input.color.toLowerCase() : '#c9a7ff'
  return { name, ingredients: [...new Set(ingredients)], effect: effect.id, message: cleanText(input.message, 'message', { max: 140 }), color }
}
