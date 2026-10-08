// Hand-maintained types mirroring supabase/migrations. Keep in sync when a
// migration changes a column (or regenerate with `supabase gen types` once the
// project is linked and diff against this file).
import type { Category } from '@shared/categories.ts'
import type { Source, SourceType } from '@shared/url.ts'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'partial' | 'failed'
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type JobType = 'enrich' | 'embed'
export type TagOrigin = 'user' | 'ai'

export type ProfileRow = {
  id: string
  user_id: string
  display_name: string | null
  avatar_url: string | null
  onboarded_at: string | null
  created_at: string
  updated_at: string
}

export type SavedItemRow = {
  id: string
  user_id: string
  url: string
  canonical_url: string | null
  source: Source
  source_type: SourceType
  title: string | null
  description: string | null
  author_name: string | null
  author_url: string | null
  thumbnail_url: string | null
  content_text: string | null
  ai_summary: string | null
  ai_category: Category | null
  personal_note: string | null
  metadata: Json
  is_favorite: boolean
  is_archived: boolean
  processing_status: ProcessingStatus
  processing_error: string | null
  user_edited: string[]
  tag_names: string
  search_document: string | null
  embedded_at: string | null
  saved_at: string
  created_at: string
  updated_at: string
}

export type CollectionRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  icon: string | null
  /** Set on sub-collections (one level deep). */
  parent_id: string | null
  created_at: string
  updated_at: string
}

export type CollectionItemRow = {
  collection_id: string
  saved_item_id: string
  created_at: string
}

export type TagRow = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type ItemTagRow = {
  item_id: string
  tag_id: string
  origin: TagOrigin
  created_at: string
}

export type ProcessingJobRow = {
  id: string
  user_id: string
  saved_item_id: string
  job_type: JobType
  status: JobStatus
  attempts: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

/** Row returned by the search RPCs: ids in rank order; rows are fetched separately. */
export type SearchHit = { id: string; rank: number }

export type SearchFilters = {
  source?: Source | null
  category?: Category | null
  collection_id?: string | null
  tag_id?: string | null
  favorite?: boolean | null
  include_archived?: boolean | null
  from?: string | null
  to?: string | null
  /** Soft hints parsed from the query ("the Reel about…"): boost, never filter. */
  boost_source?: Source | null
  boost_type?: SourceType | null
  sort?: 'relevance' | 'newest'
}

type Insert<Row, Required extends keyof Row, Omitted extends keyof Row = never> = Pick<Row, Required> &
  Partial<Omit<Row, Required | Omitted>>

type Rel<Name extends string, Col extends string, Ref extends string> = {
  foreignKeyName: Name
  columns: [Col]
  isOneToOne: false
  referencedRelation: Ref
  referencedColumns: ['id']
}

type Table<Row, I, U = Partial<Row>, R extends unknown[] = []> = {
  Row: Row
  Insert: I
  Update: U
  Relationships: R
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Insert<ProfileRow, 'user_id'>, Partial<Pick<ProfileRow, 'display_name' | 'avatar_url' | 'onboarded_at'>>>
      saved_items: Table<
        SavedItemRow,
        Insert<SavedItemRow, 'url', 'search_document' | 'embedded_at' | 'tag_names'>,
        Partial<Pick<SavedItemRow, 'title' | 'description' | 'personal_note' | 'ai_category' | 'is_favorite' | 'is_archived' | 'user_edited'>>
      >
      collections: Table<
        CollectionRow,
        Insert<CollectionRow, 'name'>,
        Partial<Pick<CollectionRow, 'name' | 'description' | 'icon' | 'parent_id'>>,
        [Rel<'collections_parent_id_fkey', 'parent_id', 'collections'>]
      >
      collection_items: Table<
        CollectionItemRow,
        Insert<CollectionItemRow, 'collection_id' | 'saved_item_id'>,
        Partial<CollectionItemRow>,
        [
          Rel<'collection_items_collection_id_fkey', 'collection_id', 'collections'>,
          Rel<'collection_items_saved_item_id_fkey', 'saved_item_id', 'saved_items'>,
        ]
      >
      tags: Table<TagRow, Insert<TagRow, 'name'>, Partial<Pick<TagRow, 'name'>>>
      item_tags: Table<
        ItemTagRow,
        Insert<ItemTagRow, 'item_id' | 'tag_id'>,
        Partial<ItemTagRow>,
        [Rel<'item_tags_item_id_fkey', 'item_id', 'saved_items'>, Rel<'item_tags_tag_id_fkey', 'tag_id', 'tags'>]
      >
      processing_jobs: Table<
        ProcessingJobRow,
        Insert<ProcessingJobRow, 'user_id' | 'saved_item_id' | 'job_type'>,
        Partial<ProcessingJobRow>
      >
    }
    Views: { [_ in never]: never }
    Functions: {
      search_items: {
        Args: { q: string; filters?: Json; lim?: number; off?: number }
        Returns: SearchHit[]
      }
      hybrid_search_items: {
        Args: { q: string; query_embedding: string; filters?: Json; lim?: number; min_similarity?: number }
        Returns: (SearchHit & { similarity: number | null; keyword_match: boolean })[]
      }
      ensure_tags: {
        Args: { names: string[] }
        Returns: TagRow[]
      }
      library_stats: {
        Args: Record<string, never>
        Returns: { saves: number; collections: number; favorites: number }[]
      }
      collection_totals: {
        Args: Record<string, never>
        Returns: { id: string; total: number }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
