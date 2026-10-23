import type { HiddenNote, NoteReveal } from '@/domain/notes'
import { api } from '../api'

export const fetchNotes = (): Promise<HiddenNote[]> => api.get<HiddenNote[]>('/notes')

export interface PlaceNoteInput {
  objectId: string
  body: string
  openWhen: string
  reveal: NoteReveal
}

/** `clientNoteId` makes retries idempotent: pass the same id when re-submitting. */
export const placeNote = (input: PlaceNoteInput, clientNoteId: string = crypto.randomUUID()): Promise<unknown> => api.post('/notes', { clientNoteId, ...input })
export const markRead = (noteId: string): Promise<unknown> => api.post(`/notes/${noteId}/read`)
export const deleteNote = (noteId: string): Promise<unknown> => api.del(`/notes/${noteId}`)
