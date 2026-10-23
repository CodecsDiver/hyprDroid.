import { REACTION_ANIMATIONS, type ReactionAnimation } from '@/domain/events'
import { cleanText, pickEnum } from '@/domain/validate'
import { db } from '../supabase'
import { unwrap } from '../query'

export interface ReactionPreset { id: string; ownerId: string; label: string; emoji: string; animation: ReactionAnimation }
interface Row { id: string; owner_id: string; label: string; emoji: string; animation: ReactionAnimation }

export async function fetchPresets(userId: string): Promise<ReactionPreset[]> {
  const rows = (await unwrap(db().from('reaction_presets').select('*').eq('owner_id', userId).order('sort_order').order('created_at'))) as Row[] | null
  return (rows ?? []).map((r) => ({ id: r.id, ownerId: r.owner_id, label: r.label, emoji: r.emoji, animation: r.animation }))
}

export async function addPreset(householdId: string, input: { label: string; emoji: string; animation: string }): Promise<void> {
  await unwrap(db().from('reaction_presets').insert({
    household_id: householdId,
    label: cleanText(input.label, 'label', { max: 24, required: true }),
    emoji: cleanText(input.emoji, 'emoji', { max: 16, required: true }),
    animation: pickEnum(input.animation, 'animation', REACTION_ANIMATIONS),
  }))
}

export async function deletePreset(id: string): Promise<void> {
  await unwrap(db().from('reaction_presets').delete().eq('id', id))
}
