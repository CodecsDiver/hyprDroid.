/** Wire types shared by the browser and the server (camelCase, exactly what the API returns). */
import type { SpriteGeometry } from '../domain/loveUniverse'
import type { MemoryKind as _MemoryKind } from './memory'

export interface PublicUser {
  id: string
  name: string
}

export interface Me {
  user: PublicUser
  partner: PublicUser
}

export interface UserSettings {
  notifyLovePings: boolean
  notifyHiddenNotes: boolean
  notifyMischief: boolean
  notifyListeningInvites: boolean
  allowMischief: boolean
  allowDisruptiveMischief: boolean
  quietHoursStart: number | null
  quietHoursEnd: number | null
}

export const DEFAULT_SETTINGS: UserSettings = {
  notifyLovePings: true, notifyHiddenNotes: true, notifyMischief: true, notifyListeningInvites: true,
  allowMischief: false, allowDisruptiveMischief: false, quietHoursStart: null, quietHoursEnd: null,
}

export type FileKind = 'music' | 'cover' | 'vault' | 'sticker' | 'capsule'

export interface FileMeta {
  id: string
  ownerId: string
  kind: FileKind
  mime: string
  size: number
  chunks: number
  sha256: string
  createdAt: string
  /** Vault files: visible to the partner. */
  shared: boolean
}

export interface SpellRecipe {
  id: string
  authorId: string
  name: string
  ingredients: string[]
  effect: string
  message: string
  color: string
  createdAt: string
}

export interface ReactionPreset {
  id: string
  ownerId: string
  label: string
  emoji: string
  animation: 'float' | 'burst' | 'pulse' | 'rain'
}

export interface Track {
  id: string
  ownerId: string
  title: string
  artist: string
  audioFileId: string
  coverFileId: string | null
  durationMs: number | null
  /** Who has marked this as "our song" (a heart from each person makes it an Our Song). */
  lovedBy?: string[]
}

export interface Playlist {
  id: string
  ownerId: string
  name: string
  coverFileId: string | null
  trackIds: string[]
}

export interface ListeningSessionRecord {
  hostId: string | null
  trackId: string | null
  playlistId: string | null
  state: 'stopped' | 'playing' | 'paused'
  positionMs: number
  /** Server clock, ms since epoch, at which positionMs was true. */
  updatedAtMs: number
  revision: number
}

export interface ListeningState {
  consent: { me: boolean; partner: boolean }
  session: ListeningSessionRecord | null
}

export type MemoryKind = _MemoryKind

export interface Memory {
  id: string
  authorId: string
  kind: MemoryKind
  title: string
  body: string
  fileId: string | null
  mimeType: string | null
  occurredOn: string | null
  visibility: 'shared' | 'private'
  createdAt: string
}

export interface LoveNote {
  id: string
  authorId: string
  voice: 'love' | 'miss'
  body: string
}

export interface Sticker {
  id: string
  ownerId: string
  label: string
  fileId: string
  sprite: SpriteGeometry | null
}

export interface CapsuleItem {
  id: string
  slug: string
  title: string
  description: string
  fileId: string
  sha256: string
  byteSize: number
  archivedAt: string
}

export type DateKind = 'anniversary' | 'birthday' | 'countdown' | 'milestone'
export const DATE_KINDS: readonly DateKind[] = ['anniversary', 'birthday', 'countdown', 'milestone']

/** A date worth remembering. `yearly` repeats it every year; otherwise it happens once. */
export interface ImportantDate {
  id: string
  authorId: string
  title: string
  date: string
  kind: DateKind
  yearly: boolean
  createdAt: string
}

export interface DailyQuestion {
  day: string
  question: string
  mine: string | null
  partnerAnswered: boolean
  /** Only present once both of you have answered. */
  partner: string | null
}

export interface DailyHistoryEntry {
  day: string
  question: string
  answers: Record<string, string>
}
