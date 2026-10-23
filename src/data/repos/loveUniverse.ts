import type { SpriteGeometry } from '@/domain/loveUniverse'
import { cleanText } from '@/domain/validate'
import { db } from '../supabase'
import { unwrap } from '../query'
import { uploadPrivate } from '../storage'

export interface LoveNote { id: string; authorId: string; voice: 'love' | 'miss'; body: string }
export interface Sticker { id: string; ownerId: string; label: string; storagePath: string; sprite: SpriteGeometry | null }

export async function fetchLoveNotes(): Promise<LoveNote[]> {
  const rows = (await unwrap(db().from('love_notes').select('id, author_id, voice, body').order('created_at'))) as { id: string; author_id: string; voice: 'love' | 'miss'; body: string }[] | null
  return (rows ?? []).map((r) => ({ id: r.id, authorId: r.author_id, voice: r.voice, body: r.body }))
}

export async function addLoveNote(householdId: string, voice: 'love' | 'miss', body: string): Promise<void> {
  await unwrap(db().from('love_notes').insert({ household_id: householdId, voice, body: cleanText(body, 'body', { max: 500, required: true }) }))
}

export async function deleteLoveNote(id: string): Promise<void> {
  await unwrap(db().from('love_notes').delete().eq('id', id))
}

interface StickerRow { id: string; owner_id: string; label: string; storage_path: string; sprite_cols: number | null; sprite_rows: number | null; sprite_index: number | null }

export async function fetchStickers(): Promise<Sticker[]> {
  const rows = (await unwrap(db().from('stickers').select('*').order('created_at'))) as StickerRow[] | null
  return (rows ?? []).map((r) => ({
    id: r.id, ownerId: r.owner_id, label: r.label, storagePath: r.storage_path,
    sprite: r.sprite_cols && r.sprite_rows && r.sprite_index !== null ? { cols: r.sprite_cols, rows: r.sprite_rows, index: r.sprite_index } : null,
  }))
}

export async function addSticker(householdId: string, userId: string, label: string, image: Blob): Promise<void> {
  const storagePath = await uploadPrivate('stickers', householdId, userId, image)
  await unwrap(db().from('stickers').insert({ household_id: householdId, label: cleanText(label, 'label', { max: 40, required: true }), storage_path: storagePath }))
}

export async function deleteSticker(id: string): Promise<void> {
  await unwrap(db().from('stickers').delete().eq('id', id))
}
