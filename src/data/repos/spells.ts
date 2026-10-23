import { validateRecipe, type SpellEffectId, type SpellRecipeInput } from '@/domain/spells'
import { db } from '../supabase'
import { unwrap } from '../query'

export interface SpellRecipe extends SpellRecipeInput { id: string; authorId: string; createdAt: string }
interface Row { id: string; author_id: string; name: string; ingredients: string[]; effect: SpellEffectId; message: string | null; color: string; created_at: string }

const fromRow = (r: Row): SpellRecipe => ({ id: r.id, authorId: r.author_id, name: r.name, ingredients: r.ingredients, effect: r.effect, message: r.message ?? '', color: r.color, createdAt: r.created_at })

export async function fetchRecipes(): Promise<SpellRecipe[]> {
  const rows = (await unwrap(db().from('spell_recipes').select('*').order('created_at', { ascending: false }))) as Row[] | null
  return (rows ?? []).map(fromRow)
}

export async function saveRecipe(householdId: string, input: Partial<Record<keyof SpellRecipeInput, unknown>>): Promise<void> {
  const recipe = validateRecipe(input)
  await unwrap(db().from('spell_recipes').insert({
    household_id: householdId, name: recipe.name, ingredients: recipe.ingredients, effect: recipe.effect,
    message: recipe.message || null, color: recipe.color,
  }))
}

export async function deleteRecipe(id: string): Promise<void> {
  await unwrap(db().from('spell_recipes').delete().eq('id', id))
}
