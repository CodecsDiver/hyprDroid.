import { db } from '../supabase'
import { unwrap } from '../query'

export interface CapsuleItem {
  id: string; slug: string; title: string; description: string; storagePath: string; sha256: string; byteSize: number; archivedAt: string
}

export async function fetchCapsuleItems(): Promise<CapsuleItem[]> {
  const rows = (await unwrap(db().from('time_capsule_items').select('*').order('archived_at'))) as
    | { id: string; slug: string; title: string; description: string | null; storage_path: string; sha256: string; byte_size: number | string; archived_at: string }[]
    | null
  return (rows ?? []).map((r) => ({ id: r.id, slug: r.slug, title: r.title, description: r.description ?? '', storagePath: r.storage_path, sha256: r.sha256, byteSize: Number(r.byte_size), archivedAt: r.archived_at }))
}
