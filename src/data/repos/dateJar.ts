import type { DateCategory, DateIdea } from '@/domain/dateJar'
import { api } from '../api'

export const fetchIdeas = (): Promise<DateIdea[]> => api.get<DateIdea[]>('/ideas')
export const addIdea = (input: { title: string; notes: string; category: DateCategory }): Promise<unknown> => api.post('/ideas', input)
export const addIdeas = (ideas: readonly { title: string; category: DateCategory }[]): Promise<unknown> => api.post('/ideas/bulk', { ideas })
export const setFavorite = (id: string, isFavorite: boolean): Promise<unknown> => api.patch(`/ideas/${id}`, { isFavorite })
export const completeIdea = (id: string, note: string, rating: number | null): Promise<unknown> =>
  api.patch(`/ideas/${id}`, { completedAt: new Date().toISOString(), completedNote: note, rating }) // the server stamps the real time
export const deleteIdea = (id: string): Promise<unknown> => api.del(`/ideas/${id}`)
