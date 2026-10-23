import { cleanText } from '@/domain/validate'
import { db } from '../supabase'
import { unwrap } from '../query'
import { removeObject, uploadPrivate } from '../storage'

export type MemoryKind = 'photo' | 'voice' | 'note' | 'milestone'
export interface Memory {
  id: string; authorId: string; kind: MemoryKind; title: string; body: string; storagePath: string | null; mimeType: string | null
  occurredOn: string | null; visibility: 'shared' | 'private'; createdAt: string
}
interface Row {
  id: string; author_id: string; kind: MemoryKind; title: string; body: string | null; storage_path: string | null; mime_type: string | null
  occurred_on: string | null; visibility: 'shared' | 'private'; created_at: string
}

const fromRow = (r: Row): Memory => ({
  id: r.id, authorId: r.author_id, kind: r.kind, title: r.title, body: r.body ?? '', storagePath: r.storage_path, mimeType: r.mime_type,
  occurredOn: r.occurred_on, visibility: r.visibility, createdAt: r.created_at,
})

export async function fetchMemories(): Promise<Memory[]> {
  const rows = (await unwrap(db().from('memories').select('*').order('created_at', { ascending: false }).limit(200))) as Row[] | null
  return (rows ?? []).map(fromRow)
}

export interface NewMemory {
  kind: MemoryKind
  title: string
  body: string
  occurredOn: string
  visibility: 'shared' | 'private'
  file: Blob | null
}

export async function addMemory(householdId: string, userId: string, input: NewMemory): Promise<void> {
  const needsFile = input.kind === 'photo' || input.kind === 'voice'
  if (needsFile && !input.file) throw new Error('A file is required')
  const storagePath = needsFile && input.file ? await uploadPrivate('vault', householdId, userId, input.file) : null
  try {
    await unwrap(db().from('memories').insert({
      household_id: householdId,
      kind: input.kind,
      title: cleanText(input.title, 'title', { max: 120, required: true }),
      body: cleanText(input.body, 'body', { max: 5000, required: input.kind === 'note' || input.kind === 'milestone' }) || null,
      storage_path: storagePath,
      mime_type: input.file ? input.file.type.split(';')[0] : null,
      size_bytes: input.file ? input.file.size : null,
      occurred_on: input.occurredOn || null,
      visibility: input.visibility,
    }))
  } catch (error) {
    if (storagePath) await removeObject('vault', storagePath).catch(() => {}) // don't orphan the upload
    throw error
  }
}

export async function setVisibility(id: string, visibility: 'shared' | 'private'): Promise<void> {
  await unwrap(db().from('memories').update({ visibility }).eq('id', id))
}

export async function deleteMemory(memory: Memory): Promise<void> {
  await unwrap(db().from('memories').delete().eq('id', memory.id))
  if (memory.storagePath) await removeObject('vault', memory.storagePath).catch(() => {})
}
