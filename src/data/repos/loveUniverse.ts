import type { LoveNote, Sticker } from '@/shared/types'
import { api } from '../api'
import { uploadFile } from '../files'

export type { LoveNote, Sticker }

export const fetchLoveNotes = (): Promise<LoveNote[]> => api.get<LoveNote[]>('/love-notes')
export const addLoveNote = (voice: 'love' | 'miss', body: string): Promise<unknown> => api.post('/love-notes', { voice, body })
export const deleteLoveNote = (id: string): Promise<unknown> => api.del(`/love-notes/${id}`)
export const fetchStickers = (): Promise<Sticker[]> => api.get<Sticker[]>('/stickers')

export async function addSticker(label: string, image: Blob): Promise<void> {
  const fileId = await uploadFile('sticker', image)
  await api.post('/stickers', { label, fileId })
}

export const deleteSticker = (id: string): Promise<unknown> => api.del(`/stickers/${id}`)
