import type { HiddenNote, NoteReveal } from '@/domain/notes'
import { cleanText, OBJECT_ID_PATTERN, ValidationError } from '@/domain/validate'
import { db } from '../supabase'
import { unwrap } from '../query'

interface Row {
  id: string; author_id: string; recipient_id: string; object_id: string; body: string; open_when: string | null
  reveal: NoteReveal; created_at: string; read_at: string | null
}

const fromRow = (r: Row): HiddenNote => ({
  id: r.id, authorId: r.author_id, recipientId: r.recipient_id, objectId: r.object_id, body: r.body, openWhen: r.open_when,
  reveal: r.reveal, createdAt: r.created_at, readAt: r.read_at,
})

export async function fetchNotes(): Promise<HiddenNote[]> {
  const rows = (await unwrap(db().from('hidden_notes').select('*').order('created_at', { ascending: false }).limit(200))) as Row[] | null
  return (rows ?? []).map(fromRow)
}

export interface PlaceNoteInput { objectId: string; body: string; openWhen: string; reveal: NoteReveal }

/** `clientNoteId` makes retries idempotent: pass the same id when re-submitting. */
export async function placeNote(input: PlaceNoteInput, clientNoteId: string = crypto.randomUUID()): Promise<void> {
  if (!OBJECT_ID_PATTERN.test(input.objectId)) throw new ValidationError('objectId', 'Choose where to hide the note')
  await unwrap(db().rpc('place_note', {
    p_client_note_id: clientNoteId,
    p_object_id: input.objectId,
    p_body: cleanText(input.body, 'body', { max: 2000, required: true }),
    p_open_when: cleanText(input.openWhen, 'openWhen', { max: 60 }) || null,
    p_reveal: input.reveal,
  }))
}

export async function markRead(noteId: string): Promise<void> {
  await unwrap(db().rpc('mark_note_read', { p_note: noteId }))
}

export async function deleteNote(noteId: string): Promise<void> {
  await unwrap(db().from('hidden_notes').delete().eq('id', noteId))
}
