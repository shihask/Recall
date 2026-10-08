import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { track } from '@/lib/analytics'
import { qk } from '@/lib/queryKeys'
import { hybridSearch, keywordSearch, type SearchPage } from '@/services/search/searchService'
import type { SearchFilters } from '@/types/database'

function hasActiveFilters(f: SearchFilters): boolean {
  return Object.entries(f).some(([k, v]) => k !== 'sort' && v !== null && v !== undefined && v !== false && v !== '')
}

/**
 * Keyword results immediately (fast, paginated); hybrid results replace them
 * for the first page when the semantic backend answers. If semantic search
 * fails or isn't deployed, keyword results simply stay.
 */
export function useSearch(q: string, filters: SearchFilters) {
  const query = q.trim()
  const enabled = query.length > 0 || hasActiveFilters(filters)

  const keyword = useInfiniteQuery({
    queryKey: [...qk.search(query, filters), 'keyword'],
    queryFn: ({ pageParam }) => keywordSearch(query, filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset,
    enabled,
    placeholderData: keepPreviousData,
  })

  // Semantic search needs words; filter-only browsing is keyword-only.
  const wantHybrid = query.length >= 3 && (filters.sort ?? 'relevance') === 'relevance'
  const hybrid = useQuery<SearchPage | null>({
    queryKey: [...qk.search(query, filters), 'hybrid'],
    queryFn: () => hybridSearch(query, filters),
    enabled: enabled && wantHybrid,
    staleTime: 60_000,
    retry: false,
  })

  useEffect(() => {
    if (query) track('search_performed')
  }, [query])

  const semantic = wantHybrid && hybrid.data && hybrid.data.hits.length > 0 ? hybrid.data : null
  const keywordHits = keyword.data?.pages.flatMap((p) => p.hits) ?? []

  // Hybrid already fuses keyword ranking; show it, then any further keyword pages not in it.
  const hits = semantic
    ? [...semantic.hits, ...keywordHits.filter((h) => !semantic.hits.some((s) => s.item.id === h.item.id))]
    : keywordHits

  return {
    enabled,
    hits,
    mode: semantic ? ('hybrid' as const) : ('keyword' as const),
    topPage: semantic ?? keyword.data?.pages[0] ?? null,
    isLoading: enabled && keyword.isPending,
    isFetching: keyword.isFetching || hybrid.isFetching,
    isError: keyword.isError,
    error: keyword.error,
    refetch: keyword.refetch,
    hasMore: keyword.hasNextPage,
    loadMore: keyword.fetchNextPage,
    loadingMore: keyword.isFetchingNextPage,
    semanticPending: wantHybrid && hybrid.isFetching,
  }
}
