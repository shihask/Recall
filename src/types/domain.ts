import type { CollectionRow, SavedItemRow, TagOrigin, TagRow } from './database'

export type ItemTag = Pick<TagRow, 'id' | 'name'> & { origin: TagOrigin }
export type ItemCollection = Pick<CollectionRow, 'id' | 'name' | 'icon'>

/** A saved item as the UI uses it (no search internals or embedding). */
export type SavedItem = Omit<SavedItemRow, 'search_document' | 'tag_names'> & {
  tags: ItemTag[]
  collections: ItemCollection[]
}

/** `item_count`: saves directly in it. `total_count`: distinct saves in it and its sub-collections. */
export type CollectionWithCount = CollectionRow & { item_count: number; total_count: number }
export type TagWithCount = TagRow & { item_count: number }

export type LibraryView = 'all' | 'favorites' | 'archive'

export interface ListParams {
  view: LibraryView
  collectionId?: string
  /** With `collectionId`: also include these (a parent's sub-collections). */
  subCollectionIds?: string[]
  tagId?: string
}

export interface Page<T> {
  items: T[]
  nextOffset: number | null
}

export const PAGE_SIZE = 20
