import { supabase } from '@/lib/supabase'
import type { CollectionRow } from '@/types/database'
import type { CollectionWithCount } from '@/types/domain'
import { AppError, toAppError } from './errors'

export interface CollectionInput {
  name: string
  icon?: string | null
  description?: string | null
}

function clean(input: CollectionInput): Required<CollectionInput> {
  const name = input.name.replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!name) throw new AppError('invalid', 'Give your collection a name.')
  return {
    name,
    icon: input.icon?.trim().slice(0, 16) || null,
    description: input.description?.trim().slice(0, 500) || null,
  }
}

function friendly(error: unknown): AppError {
  const e = toAppError(error)
  return e.code === 'conflict' ? new AppError('conflict', 'You already have a collection with that name.', { cause: error }) : e
}

export async function listCollections(): Promise<CollectionWithCount[]> {
  const { data, error } = await supabase
    .from('collections')
    .select('*, collection_items(count)')
    .order('updated_at', { ascending: false })
    .overrideTypes<(CollectionRow & { collection_items: { count: number }[] })[], { merge: false }>()
  if (error) throw toAppError(error)
  return data.map(({ collection_items, ...c }) => ({ ...c, item_count: collection_items[0]?.count ?? 0 }))
}

export async function getCollection(id: string): Promise<CollectionRow | null> {
  const { data, error } = await supabase.from('collections').select('*').eq('id', id).maybeSingle()
  if (error) throw toAppError(error)
  return data
}

export async function createCollection(input: CollectionInput): Promise<CollectionRow> {
  const { data, error } = await supabase.from('collections').insert(clean(input)).select('*').single()
  if (error) throw friendly(error)
  return data
}

export async function updateCollection(id: string, input: CollectionInput): Promise<void> {
  const { error } = await supabase.from('collections').update(clean(input)).eq('id', id)
  if (error) throw friendly(error)
}

/** Deletes the collection only — its saves stay in the library. */
export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase.from('collections').delete().eq('id', id)
  if (error) throw toAppError(error)
}
