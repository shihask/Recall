import { parseSearchIntent } from '@shared/query.ts'
import { supabase } from '@/lib/supabase'
import { getItemsByIds } from '@/services/supabase/items'
import { toAppError } from '@/services/supabase/errors'
import type { Json, SearchFilters } from '@/types/database'
import type { SavedItem } from '@/types/domain'

export const SEARCH_PAGE_SIZE = 20

export interface SearchHitItem {
  item: SavedItem
  rank: number
  /** Cosine similarity when semantic search contributed (0–1). */
  similarity: number | null
  /** Matched by keyword search too (vs. meaning only). */
  keywordMatch: boolean
}

export interface SearchPage {
  hits: SearchHitItem[]
  nextOffset: number | null
  mode: 'keyword' | 'hybrid'
}

function filtersWithHints(q: string, filters: SearchFilters): { terms: string; filters: SearchFilters } {
  const intent = parseSearchIntent(q)
  return {
    terms: intent.terms,
    filters: { ...filters, boost_source: intent.boostSource, boost_type: intent.boostType },
  }
}

/** V1 keyword search: RPC returns ranked ids; rows are fetched with RLS. */
export async function keywordSearch(q: string, filters: SearchFilters, offset: number): Promise<SearchPage> {
  const { terms, filters: f } = filtersWithHints(q, filters)
  const { data, error } = await supabase.rpc('search_items', { q: terms, filters: f as Json, lim: SEARCH_PAGE_SIZE, off: offset })
  if (error) throw toAppError(error)
  const hits = data ?? []
  const items = await getItemsByIds(hits.map((h) => h.id))
  const rankById = new Map(hits.map((h) => [h.id, h.rank]))
  return {
    hits: items.map((item) => ({ item, rank: rankById.get(item.id) ?? 0, similarity: null, keywordMatch: true })),
    nextOffset: hits.length === SEARCH_PAGE_SIZE ? offset + SEARCH_PAGE_SIZE : null,
    mode: 'keyword',
  }
}

interface HybridHit {
  id: string
  rank: number
  similarity: number | null
  keyword_match: boolean
}

/**
 * Hybrid (keyword + meaning) search via the `search` Edge Function, which
 * embeds the query server-side. Returns null when semantic search isn't
 * available, so callers keep the keyword results.
 */
export async function hybridSearch(q: string, filters: SearchFilters): Promise<SearchPage | null> {
  const { terms, filters: f } = filtersWithHints(q, filters)
  try {
    const { data, error } = await supabase.functions.invoke<{ results: HybridHit[] }>('search', {
      body: { q: parseSearchIntent(q).original, terms, filters: f, limit: 30 },
    })
    if (error || !data) return null
    const items = await getItemsByIds(data.results.map((r) => r.id))
    const byId = new Map(data.results.map((r) => [r.id, r]))
    return {
      hits: items.map((item) => {
        const r = byId.get(item.id)
        return { item, rank: r?.rank ?? 0, similarity: r?.similarity ?? null, keywordMatch: r?.keyword_match ?? false }
      }),
      nextOffset: null,
      mode: 'hybrid',
    }
  } catch {
    return null
  }
}

/**
 * "I think I found it." — only when the top hit clearly stands out. Better to
 * show a plain list than to sound confident about the wrong thing.
 */
export function confidentTopHit(page: SearchPage | null | undefined): SearchHitItem | null {
  const [first, second] = page?.hits ?? []
  if (!first) return null
  if (page?.mode === 'hybrid') {
    const sim = first.similarity ?? 0
    const strong = (first.keywordMatch && sim >= 0.8) || sim >= 0.86
    const margin = !second || first.rank >= second.rank * 1.15
    return strong && margin ? first : null
  }
  // Keyword-only: a single clear match, or one that dominates the next.
  if (!second) return first.rank > 0.05 ? first : null
  return first.rank > 0.1 && first.rank >= second.rank * 1.6 ? first : null
}
