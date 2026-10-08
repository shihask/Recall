import { supabase } from '@/lib/supabase'
import type { CollectionRow } from '@/types/database'
import type { CollectionWithCount } from '@/types/domain'
import { AppError, toAppError } from './errors'

export interface CollectionInput {
  name: string
  icon?: string | null
  description?: string | null
  /** `null` makes it top-level; omit to leave it where it is. */
  parentId?: string | null
}

type CollectionWrite = Pick<CollectionRow, 'name' | 'icon' | 'description'> & { parent_id?: string | null }

function clean(input: CollectionInput): CollectionWrite {
  const name = input.name.replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!name) throw new AppError('invalid', 'Give your collection a name.')
  return {
    name,
    icon: input.icon?.trim().slice(0, 16) || null,
    description: input.description?.trim().slice(0, 500) || null,
    ...(input.parentId !== undefined && { parent_id: input.parentId || null }),
  }
}

function friendly(error: unknown): AppError {
  const e = toAppError(error)
  if (e.code === 'conflict') return new AppError('conflict', 'You already have a collection with that name.', { cause: error })
  const message = (error as { message?: string } | null)?.message ?? ''
  if (message.includes('cannot become a sub-collection')) {
    return new AppError('invalid', 'This collection has its own sub-collections, so it can’t go inside another one.', { cause: error })
  }
  return e
}

export async function listCollections(): Promise<CollectionWithCount[]> {
  const [list, totals] = await Promise.all([
    supabase
      .from('collections')
      .select('*, collection_items(count)')
      .order('updated_at', { ascending: false })
      .overrideTypes<(CollectionRow & { collection_items: { count: number }[] })[], { merge: false }>(),
    supabase.rpc('collection_totals'),
  ])
  if (list.error) throw toAppError(list.error)
  if (totals.error) throw toAppError(totals.error)
  const totalById = new Map(totals.data.map((t) => [t.id, Number(t.total)]))
  return list.data.map(({ collection_items, ...c }) => {
    const item_count = collection_items[0]?.count ?? 0
    return { ...c, item_count, total_count: totalById.get(c.id) ?? item_count }
  })
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

/** Deletes the collection only — its saves stay in the library and its sub-collections move to the top level. */
export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase.from('collections').delete().eq('id', id)
  if (error) throw toAppError(error)
}
