import type { Memory, MemoryKind } from '@/shared/types'
import { api } from '../api'
import { deleteFile, uploadFile } from '../files'

export type { Memory, MemoryKind }

export const fetchMemories = (): Promise<Memory[]> => api.get<Memory[]>('/memories')

export interface NewMemory {
  kind: MemoryKind
  title: string
  body: string
  occurredOn: string
  visibility: 'shared' | 'private'
  file: Blob | null
}

export async function addMemory(input: NewMemory): Promise<void> {
  const needsFile = input.kind === 'photo' || input.kind === 'voice'
  if (needsFile && !input.file) throw new Error('A file is required')
  const fileId = needsFile && input.file ? await uploadFile('vault', input.file) : null
  try {
    await api.post('/memories', { kind: input.kind, title: input.title, body: input.body, fileId, occurredOn: input.occurredOn || null, visibility: input.visibility })
  } catch (error) {
    if (fileId) await deleteFile(fileId).catch(() => {}) // don't orphan the upload
    throw error
  }
}

export const setVisibility = (id: string, visibility: 'shared' | 'private'): Promise<unknown> => api.patch(`/memories/${id}`, { visibility })
export const deleteMemory = (memory: Memory): Promise<unknown> => api.del(`/memories/${memory.id}`)
