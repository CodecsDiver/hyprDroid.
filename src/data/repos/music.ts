import { cleanText } from '@/domain/validate'
import type { SyncSession } from '@/domain/listeningSync'
import { db } from '../supabase'
import { unwrap, unwrapOrNull } from '../query'
import { uploadPrivate } from '../storage'

export interface Track { id: string; ownerId: string; title: string; artist: string; audioPath: string; coverPath: string | null; durationMs: number | null }
export interface Playlist { id: string; ownerId: string; name: string; coverPath: string | null; trackIds: string[] }

interface TrackRow { id: string; owner_id: string; title: string; artist: string | null; audio_path: string; cover_path: string | null; duration_ms: number | null }

export async function fetchTracks(): Promise<Track[]> {
  const rows = (await unwrap(db().from('tracks').select('*').order('created_at', { ascending: false }))) as TrackRow[] | null
  return (rows ?? []).map((r) => ({ id: r.id, ownerId: r.owner_id, title: r.title, artist: r.artist ?? '', audioPath: r.audio_path, coverPath: r.cover_path, durationMs: r.duration_ms }))
}

export async function addTrack(householdId: string, userId: string, input: { title: string; artist: string; audio: File; cover: File | null; durationMs: number | null }): Promise<void> {
  const audioPath = await uploadPrivate('music', householdId, userId, input.audio)
  const coverPath = input.cover ? await uploadPrivate('covers', householdId, userId, input.cover) : null
  await unwrap(db().from('tracks').insert({
    household_id: householdId,
    title: cleanText(input.title, 'title', { max: 120, required: true }),
    artist: cleanText(input.artist, 'artist', { max: 120 }) || null,
    audio_path: audioPath,
    cover_path: coverPath,
    duration_ms: input.durationMs,
  }))
}

export async function deleteTrack(id: string): Promise<void> {
  await unwrap(db().from('tracks').delete().eq('id', id))
}

export async function fetchPlaylists(): Promise<Playlist[]> {
  const lists = (await unwrap(db().from('playlists').select('id, owner_id, name, cover_path').order('created_at'))) as { id: string; owner_id: string; name: string; cover_path: string | null }[] | null
  const links = (await unwrap(db().from('playlist_tracks').select('playlist_id, track_id, position').order('position'))) as { playlist_id: string; track_id: string; position: number }[] | null
  return (lists ?? []).map((list) => ({
    id: list.id, ownerId: list.owner_id, name: list.name, coverPath: list.cover_path,
    trackIds: (links ?? []).filter((link) => link.playlist_id === list.id).map((link) => link.track_id),
  }))
}

export async function createPlaylist(householdId: string, name: string, cover: File | null, userId: string): Promise<void> {
  const coverPath = cover ? await uploadPrivate('covers', householdId, userId, cover) : null
  await unwrap(db().from('playlists').insert({ household_id: householdId, name: cleanText(name, 'name', { max: 60, required: true }), cover_path: coverPath }))
}

export async function deletePlaylist(id: string): Promise<void> {
  await unwrap(db().from('playlists').delete().eq('id', id))
}

/** Replaces the playlist's track order. */
export async function setPlaylistTracks(householdId: string, playlistId: string, trackIds: readonly string[]): Promise<void> {
  await unwrap(db().from('playlist_tracks').delete().eq('playlist_id', playlistId))
  if (trackIds.length === 0) return
  await unwrap(db().from('playlist_tracks').insert(trackIds.map((trackId, position) => ({ playlist_id: playlistId, track_id: trackId, household_id: householdId, position }))))
}

export interface ListeningState {
  consent: { me: boolean; partner: boolean }
  session: (SyncSession & { trackId: string | null; playlistId: string | null; hostId: string | null }) | null
}

export async function fetchListeningState(userId: string): Promise<ListeningState> {
  const consent = (await unwrap(db().from('listening_consent').select('user_id, opted_in'))) as { user_id: string; opted_in: boolean }[] | null
  const row = (await unwrapOrNull(db().from('listening_sessions').select('*').maybeSingle())) as
    | { track_id: string | null; playlist_id: string | null; host_id: string | null; state: SyncSession['state']; position_ms: number; updated_at: string; revision: number | string }
    | null
  return {
    consent: {
      me: !!consent?.find((c) => c.user_id === userId)?.opted_in,
      partner: !!consent?.find((c) => c.user_id !== userId)?.opted_in,
    },
    session: row
      ? { trackId: row.track_id, playlistId: row.playlist_id, hostId: row.host_id, state: row.state, positionMs: row.position_ms, updatedAtMs: Date.parse(row.updated_at), revision: Number(row.revision) }
      : null,
  }
}

export async function setListeningConsent(optedIn: boolean): Promise<void> {
  await unwrap(db().rpc('listening_set_consent', { p_opted_in: optedIn }))
}

export async function sendListeningCommand(action: 'play' | 'pause' | 'seek' | 'stop', args: { trackId?: string | null; positionMs?: number; playlistId?: string | null } = {}): Promise<void> {
  await unwrap(db().rpc('listening_command', {
    p_action: action, p_track: args.trackId ?? null, p_position_ms: Math.max(0, Math.round(args.positionMs ?? 0)), p_playlist: args.playlistId ?? null,
  }))
}
