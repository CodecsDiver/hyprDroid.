import type { ListeningState, Playlist, Track } from '@/shared/types'
import { api } from '../api'
import { uploadFile } from '../files'

export type { ListeningState, Playlist, Track }

export const fetchTracks = (): Promise<Track[]> => api.get<Track[]>('/tracks')

export async function addTrack(input: { title: string; artist: string; audio: File; cover: File | null; durationMs: number | null }): Promise<void> {
  const audioFileId = await uploadFile('music', input.audio)
  const coverFileId = input.cover ? await uploadFile('cover', input.cover) : null
  await api.post('/tracks', { title: input.title, artist: input.artist, audioFileId, coverFileId, durationMs: input.durationMs })
}

export const deleteTrack = (id: string): Promise<unknown> => api.del(`/tracks/${id}`)
export const fetchPlaylists = (): Promise<Playlist[]> => api.get<Playlist[]>('/playlists')

export async function createPlaylist(name: string, cover: File | null): Promise<void> {
  const coverFileId = cover ? await uploadFile('cover', cover) : null
  await api.post('/playlists', { name, coverFileId })
}

export const deletePlaylist = (id: string): Promise<unknown> => api.del(`/playlists/${id}`)
/** Replaces the playlist's track order. */
export const setPlaylistTracks = (playlistId: string, trackIds: readonly string[]): Promise<unknown> => api.put(`/playlists/${playlistId}/tracks`, { trackIds })

export const fetchListeningState = (): Promise<ListeningState> => api.get<ListeningState>('/listening')
export const setListeningConsent = (optedIn: boolean): Promise<unknown> => api.put('/listening/consent', { optedIn })
export const sendListeningCommand = (action: 'play' | 'pause' | 'seek' | 'stop', args: { trackId?: string | null; positionMs?: number; playlistId?: string | null } = {}): Promise<unknown> =>
  api.post('/listening/command', { action, trackId: args.trackId ?? null, positionMs: Math.max(0, Math.round(args.positionMs ?? 0)), playlistId: args.playlistId ?? null })
