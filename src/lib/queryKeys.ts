import type { SearchFilters } from '@/types/database'
import type { ListParams } from '@/types/domain'

// Centralized so invalidation after a mutation is never a guessing game.
export const qk = {
  items: () => ['items'] as const,
  itemList: (params: ListParams) => ['items', 'list', params] as const,
  item: (id: string) => ['items', 'detail', id] as const,
  duplicate: (canonical: string) => ['items', 'duplicate', canonical] as const,
  recentInCollections: () => ['items', 'recent-in-collections'] as const,
  stats: () => ['items', 'stats'] as const,
  search: (q: string, filters: SearchFilters) => ['items', 'search', q, filters] as const,
  collections: () => ['collections'] as const,
  collection: (id: string) => ['collections', id] as const,
  tags: () => ['tags'] as const,
  tag: (id: string) => ['tags', id] as const,
  profile: () => ['profile'] as const,
}
