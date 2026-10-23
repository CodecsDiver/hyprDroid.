import { computed, ref } from 'vue'
import { fetchNotes } from '@/data/repos/notes'
import type { HiddenNote } from '@/domain/notes'
import { unreadByObject } from '@/domain/notes'
import { session } from './session'

export const notes = ref<HiddenNote[]>([])

export async function refreshNotes(): Promise<void> {
  notes.value = await fetchNotes()
}

export const unreadCounts = computed(() => (session.userId ? unreadByObject(notes.value, session.userId) : new Map<string, number>()))
export const totalUnread = computed(() => [...unreadCounts.value.values()].reduce((sum, n) => sum + n, 0))
