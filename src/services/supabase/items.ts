import type { AnalyzedUrl } from '@shared/url.ts'
import { supabase } from '@/lib/supabase'
import type { SavedItemRow, TagOrigin } from '@/types/database'
import { PAGE_SIZE, type ItemCollection, type ItemTag, type ListParams, type Page, type SavedItem } from '@/types/domain'
import { toAppError } from './errors'
import { ensureTags } from './tags'

// Explicit column list: never pull `embedding` (≈4 KB per row) or the search
// internals into the browser.
const ITEM_COLUMNS = [
  'id', 'user_id', 'url', 'canonical_url', 'source', 'source_type', 'title', 'description',
  'author_name', 'author_url', 'thumbnail_url', 'content_text', 'ai_summary', 'ai_category',
  'personal_note', 'metadata', 'is_favorite', 'is_archived', 'processing_status', 'processing_error',
  'user_edited', 'embedded_at', 'saved_at', 'created_at', 'updated_at',
].join(', ')

const ITEM_SELECT = `${ITEM_COLUMNS}, item_tags(origin, tags(id, name)), collection_items(collections(id, name, icon))`

type RawItem = Omit<SavedItem, 'tags' | 'collections'> & {
  item_tags?: { origin: TagOrigin; tags: { id: string; name: string } | null }[]
  collection_items?: { collections: ItemCollection | null }[]
}

function toSavedItem(raw: RawItem): SavedItem {
  const { item_tags, collection_items, ...rest } = raw
  const tags: ItemTag[] = (item_tags ?? [])
    .filter((t): t is { origin: TagOrigin; tags: { id: string; name: string } } => t.tags !== null)
    .map((t) => ({ id: t.tags.id, name: t.tags.name, origin: t.origin }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const collections: ItemCollection[] = (collection_items ?? [])
    .map((c) => c.collections)
    .filter((c): c is ItemCollection => c !== null)
  return { ...rest, tags, collections }
}

export async function listItems(params: ListParams, offset: number): Promise<Page<SavedItem>> {
  // Inner joins turn the embedded relation into a filter for collection/tag views.
  let select = ITEM_SELECT
  if (params.collectionId) select += ', filter_collection:collection_items!inner(collection_id)'
  if (params.tagId) select += ', filter_tag:item_tags!inner(tag_id)'

  let query = supabase.from('saved_items').select(select)
  if (params.view === 'archive') query = query.eq('is_archived', true)
  else query = query.eq('is_archived', false)
  if (params.view === 'favorites') query = query.eq('is_favorite', true)
  if (params.collectionId) query = query.eq('filter_collection.collection_id', params.collectionId)
  if (params.tagId) query = query.eq('filter_tag.tag_id', params.tagId)

  const { data, error } = await query
    .order('saved_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
    .overrideTypes<RawItem[], { merge: false }>()
  if (error) throw toAppError(error)
  const items = data.map(toSavedItem)
  return { items, nextOffset: items.length === PAGE_SIZE ? offset + PAGE_SIZE : null }
}

export async function getItem(id: string): Promise<SavedItem | null> {
  const { data, error } = await supabase
    .from('saved_items')
    .select(ITEM_SELECT)
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<RawItem | null, { merge: false }>()
  if (error) throw toAppError(error)
  return data ? toSavedItem(data) : null
}

/** Fetch specific items (search hits) and return them in the given order. */
export async function getItemsByIds(ids: string[]): Promise<SavedItem[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('saved_items')
    .select(ITEM_SELECT)
    .in('id', ids)
    .overrideTypes<RawItem[], { merge: false }>()
  if (error) throw toAppError(error)
  const byId = new Map(data.map((r) => [r.id, toSavedItem(r)]))
  return ids.map((id) => byId.get(id)).filter((x): x is SavedItem => x !== undefined)
}

/** "Continue exploring": items most recently added to any collection. */
export async function recentFromCollections(limit = 6): Promise<SavedItem[]> {
  const { data, error } = await supabase
    .from('collection_items')
    .select(`created_at, saved_items!inner(${ITEM_SELECT})`)
    .eq('saved_items.is_archived', false)
    .order('created_at', { ascending: false })
    .limit(limit * 3)
    .overrideTypes<{ created_at: string; saved_items: RawItem }[], { merge: false }>()
  if (error) throw toAppError(error)
  const seen = new Set<string>()
  const out: SavedItem[] = []
  for (const row of data) {
    if (seen.has(row.saved_items.id)) continue
    seen.add(row.saved_items.id)
    out.push(toSavedItem(row.saved_items))
    if (out.length === limit) break
  }
  return out
}

export type DuplicateMatch =Pick<SavedItemRow, 'id' | 'title' | 'saved_at' | 'is_archived'>

export async function findDuplicate(canonicalUrl: string): Promise<DuplicateMatch | null> {
  const { data, error } = await supabase
    .from('saved_items')
    .select('id, title, saved_at, is_archived')
    .eq('canonical_url', canonicalUrl)
    .order('saved_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw toAppError(error)
  return data
}

export interface CreateItemInput {
  analyzed: AnalyzedUrl
  note?: string
  collectionIds?: string[]
  tagNames?: string[]
}

export interface CreateItemResult {
  item: SavedItemRow
  /** Optional extras (tags/collections/job) that failed. The save itself succeeded. */
  warnings: string[]
}

/**
 * Save first, decorate second. The saved_items insert is the only step that
 * can fail the operation — tags, collections and the processing job are
 * best-effort so a hiccup there never loses the user's save.
 */
export async function createItem(input: CreateItemInput): Promise<CreateItemResult> {
  const { analyzed } = input
  const note = input.note?.trim() || null

  const { data: item, error } = await supabase
    .from('saved_items')
    .insert({
      url: analyzed.url,
      canonical_url: analyzed.canonicalUrl,
      source: analyzed.source,
      source_type: analyzed.sourceType,
      personal_note: note,
      processing_status: 'pending',
    })
    .select(ITEM_COLUMNS)
    .single()
    .overrideTypes<SavedItemRow, { merge: false }>()
  if (error) throw toAppError(error, 'We couldn’t save that. Please try again.')

  const warnings: string[] = []

  const extras = await Promise.allSettled([
    input.tagNames?.length ? setUserTags(item.id, input.tagNames) : Promise.resolve(),
    input.collectionIds?.length ? addToCollections(item.id, input.collectionIds) : Promise.resolve(),
    enqueueJob(item.id, item.user_id, 'enrich'),
  ])
  if (extras[0].status === 'rejected') warnings.push('tags')
  if (extras[1].status === 'rejected') warnings.push('collections')
  if (extras[2].status === 'rejected') warnings.push('processing')

  return { item, warnings }
}

async function enqueueJob(itemId: string, userId: string, jobType: 'enrich' | 'embed'): Promise<void> {
  const { error } = await supabase.from('processing_jobs').insert({ saved_item_id: itemId, user_id: userId, job_type: jobType })
  // 23505 = an active job of this type already exists: that's the goal anyway.
  if (error && error.code !== '23505') throw toAppError(error)
}

/** Add user tags by name (created if missing). Existing tags are kept. */
export async function setUserTags(itemId: string, names: string[]): Promise<void> {
  const tags = await ensureTags(names)
  if (tags.length === 0) return
  const { error } = await supabase
    .from('item_tags')
    .upsert(tags.map((t) => ({ item_id: itemId, tag_id: t.id, origin: 'user' as const })), { onConflict: 'item_id,tag_id', ignoreDuplicates: true })
  if (error) throw toAppError(error)
}

export async function removeTag(itemId: string, tagId: string): Promise<void> {
  const { error } = await supabase.from('item_tags').delete().eq('item_id', itemId).eq('tag_id', tagId)
  if (error) throw toAppError(error)
}

export async function addToCollections(itemId: string, collectionIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('collection_items')
    .upsert(collectionIds.map((collection_id) => ({ collection_id, saved_item_id: itemId })), {
      onConflict: 'collection_id,saved_item_id',
      ignoreDuplicates: true,
    })
  if (error) throw toAppError(error)
}

export async function removeFromCollection(itemId: string, collectionId: string): Promise<void> {
  const { error } = await supabase.from('collection_items').delete().eq('saved_item_id', itemId).eq('collection_id', collectionId)
  if (error) throw toAppError(error)
}

export type ItemPatch = Partial<Pick<SavedItemRow, 'title' | 'description' | 'personal_note' | 'ai_category' | 'is_favorite' | 'is_archived' | 'user_edited'>>

export async function updateItem(id: string, patch: ItemPatch): Promise<void> {
  const { error } = await supabase.from('saved_items').update(patch).eq('id', id)
  if (error) throw toAppError(error)
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('saved_items').delete().eq('id', id)
  if (error) throw toAppError(error)
}

/**
 * Kick off background processing. Fire-and-forget: a failure here never
 * affects the save — the item stays pending/partial and can be reprocessed
 * manually (or by the retry worker once it exists).
 */
export async function requestProcessing(itemId: string, options: { force?: boolean; jobType?: 'enrich' | 'embed' } = {}): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('process-saved-item', {
      body: { item_id: itemId, force: options.force ?? false, job_type: options.jobType ?? 'enrich' },
    })
    return !error
  } catch {
    return false
  }
}

export async function libraryStats(): Promise<{ saves: number; collections: number; favorites: number }> {
  const { data, error } = await supabase.rpc('library_stats')
  if (error) throw toAppError(error)
  const row = data?.[0]
  return { saves: Number(row?.saves ?? 0), collections: Number(row?.collections ?? 0), favorites: Number(row?.favorites ?? 0) }
}
