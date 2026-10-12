import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client'

const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60_000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Must be at least the persisted max age, or restored queries are dropped before they're used.
      gcTime: CACHE_MAX_AGE_MS,
      retry: (count, error) => count < 2 && !isAuthError(error),
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
})

function isAuthError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status
  return status === 401 || status === 403
}

const CACHE_KEY = 'recall:query-cache'

// Every request is a round trip to the Supabase region, so opening the app
// shows the last-seen library from this cache right away and refreshes it
// in the background.
const persister = createSyncStoragePersister({ storage: safeLocalStorage(), key: CACHE_KEY })

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister,
  maxAge: CACHE_MAX_AGE_MS,
  // Bump when a cached data shape changes, so old caches are thrown away.
  buster: 'v1',
  dehydrateOptions: {
    // Search results and duplicate checks are per-moment lookups; not worth keeping.
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && query.queryKey[1] !== 'search' && query.queryKey[1] !== 'duplicate',
  },
}

/** Drop everything cached for this account, in memory and on disk. */
export function clearQueryCache(): void {
  queryClient.clear()
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // Blocked storage: nothing was persisted.
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}
