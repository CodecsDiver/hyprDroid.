import type { DateCategory, DateIdea } from '@/domain/dateJar'
import { cleanText } from '@/domain/validate'
import { db } from '../supabase'
import { unwrap } from '../query'

interface Row {
  id: string; title: string; notes: string | null; category: DateCategory; is_favorite: boolean; completed_at: string | null
  completed_note: string | null; rating: number | null; created_by: string; created_at: string
}

const fromRow = (r: Row): DateIdea => ({
  id: r.id, title: r.title, notes: r.notes, category: r.category, isFavorite: r.is_favorite, completedAt: r.completed_at,
  completedNote: r.completed_note, rating: r.rating, createdBy: r.created_by, createdAt: r.created_at,
})

export async function fetchIdeas(): Promise<DateIdea[]> {
  const rows = (await unwrap(db().from('date_ideas').select('*').order('created_at', { ascending: false }))) as Row[] | null
  return (rows ?? []).map(fromRow)
}

export async function addIdea(householdId: string, input: { title: string; notes: string; category: DateCategory }): Promise<void> {
  await unwrap(db().from('date_ideas').insert({
    household_id: householdId,
    title: cleanText(input.title, 'title', { max: 120, required: true }),
    notes: cleanText(input.notes, 'notes', { max: 500 }) || null,
    category: input.category,
  }))
}

export async function addIdeas(householdId: string, ideas: readonly { title: string; category: DateCategory }[]): Promise<void> {
  await unwrap(db().from('date_ideas').insert(ideas.map((idea) => ({ household_id: householdId, title: idea.title, category: idea.category }))))
}

export async function setFavorite(id: string, isFavorite: boolean): Promise<void> {
  await unwrap(db().from('date_ideas').update({ is_favorite: isFavorite }).eq('id', id))
}

export async function completeIdea(id: string, note: string, rating: number | null): Promise<void> {
  await unwrap(db().from('date_ideas').update({
    completed_at: new Date().toISOString(), // replaced by the server's clock by a trigger
    completed_note: cleanText(note, 'note', { max: 500 }) || null,
    rating: rating && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
  }).eq('id', id))
}

export async function deleteIdea(id: string): Promise<void> {
  await unwrap(db().from('date_ideas').delete().eq('id', id))
}
