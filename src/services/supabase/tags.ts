import { supabase } from '@/lib/supabase'
import type { TagRow } from '@/types/database'
import type { TagWithCount } from '@/types/domain'
import { toAppError } from './errors'

export const MAX_TAG_LENGTH = 40

/** Trim, collapse whitespace, cap length; drop empties and case-insensitive dupes. */
export function normalizeTagNames(names: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of names) {
    const name = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH).trim()
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

export async function ensureTags(names: string[]): Promise<TagRow[]> {
  const cleaned = normalizeTagNames(names)
  if (cleaned.length === 0) return []
  const { data, error } = await supabase.rpc('ensure_tags', { names: cleaned })
  if (error) throw toAppError(error)
  return data ?? []
}

export async function listTags(): Promise<TagWithCount[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('id, user_id, name, created_at, item_tags(count)')
    .order('name')
    .overrideTypes<(TagRow & { item_tags: { count: number }[] })[], { merge: false }>()
  if (error) throw toAppError(error)
  return data.map(({ item_tags, ...t }) => ({ ...t, item_count: item_tags[0]?.count ?? 0 }))
}

export async function getTag(id: string): Promise<TagRow | null> {
  const { data, error } = await supabase.from('tags').select('*').eq('id', id).maybeSingle()
  if (error) throw toAppError(error)
  return data
}

export async function renameTag(id: string, name: string): Promise<void> {
  const [clean] = normalizeTagNames([name])
  if (!clean) throw toAppError({ code: '23514' })
  const { error } = await supabase.from('tags').update({ name: clean }).eq('id', id)
  if (error) throw toAppError(error)
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throw toAppError(error)
}
