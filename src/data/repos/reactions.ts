import type { ReactionPreset } from '@/shared/types'
import { api } from '../api'

export type { ReactionPreset }
export const fetchPresets = (): Promise<ReactionPreset[]> => api.get<ReactionPreset[]>('/presets')
export const addPreset = (input: { label: string; emoji: string; animation: string }): Promise<unknown> => api.post('/presets', input)
export const deletePreset = (id: string): Promise<unknown> => api.del(`/presets/${id}`)
