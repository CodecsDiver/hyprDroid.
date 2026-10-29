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
  /** Sealed until this day (`YYYY-MM-DD`, UTC). */
  unlockOn?: string | null
  /** True for the recipient until the seal opens; the text is withheld until then. */
  sealed?: boolean
}

export function unreadByObject(notes: readonly HiddenNote[], myUserId: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const note of notes) {
    if (note.recipientId === myUserId && note.readAt === null && !note.sealed) counts.set(note.objectId, (counts.get(note.objectId) ?? 0) + 1)
  }
  return counts
}

export function unreadForObject(notes: readonly HiddenNote[], myUserId: string, objectId: string): HiddenNote[] {
  return notes
    .filter((note) => note.recipientId === myUserId && note.readAt === null && !note.sealed && note.objectId === objectId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
}
