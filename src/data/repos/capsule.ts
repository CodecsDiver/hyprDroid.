import type { CapsuleItem } from '@/shared/types'
import { api } from '../api'

export type { CapsuleItem }
export const fetchCapsuleItems = (): Promise<CapsuleItem[]> => api.get<CapsuleItem[]>('/capsule')
