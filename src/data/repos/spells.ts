import type { SpellEffectId, SpellRecipeInput } from '@/domain/spells'
import type { SpellRecipe as WireRecipe } from '@/shared/types'
import { api } from '../api'

export type SpellRecipe = Omit<WireRecipe, 'effect'> & { effect: SpellEffectId }

export const fetchRecipes = (): Promise<SpellRecipe[]> => api.get<SpellRecipe[]>('/recipes')
export const saveRecipe = (input: Partial<Record<keyof SpellRecipeInput, unknown>>): Promise<unknown> => api.post('/recipes', input)
export const deleteRecipe = (id: string): Promise<unknown> => api.del(`/recipes/${id}`)
