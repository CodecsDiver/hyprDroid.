export type NoteReveal = 'none' | 'fade' | 'envelope' | 'sparkle' | 'spell'
export const NOTE_REVEALS: readonly { id: NoteReveal; label: string }[] = [
  { id: 'fade', label: 'Gentle fade' },
  { id: 'envelope', label: 'Envelope' },
  { id: 'sparkle', label: 'Sparkles' },
  { id: 'spell', label: 'Spell' },
  { id: 'none', label: 'No animation' },
]

export interface HiddenNote {
  id: string
  authorId: string
  recipientId: string
  objectId: string
  body: string
  openWhen: string | null
  reveal: NoteReveal
  createdAt: string
  readAt: string | null
}

export function unreadByObject(notes: readonly HiddenNote[], myUserId: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const note of notes) {
    if (note.recipientId === myUserId && note.readAt === null) counts.set(note.objectId, (counts.get(note.objectId) ?? 0) + 1)
  }
  return counts
}

export function unreadForObject(notes: readonly HiddenNote[], myUserId: string, objectId: string): HiddenNote[] {
  return notes
    .filter((note) => note.recipientId === myUserId && note.readAt === null && note.objectId === objectId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
}
