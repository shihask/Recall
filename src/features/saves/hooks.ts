import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { track } from '@/lib/analytics'
import { qk } from '@/lib/queryKeys'
import { errorMessage } from '@/services/supabase/errors'
import {
  createItem,
  deleteItem,
  getItem,
  libraryStats,
  listItems,
  requestProcessing,
  updateItem,
  type CreateItemInput,
  type ItemPatch,
} from '@/services/supabase/items'
import type { ListParams, Page, SavedItem } from '@/types/domain'

export function useItems(params: ListParams) {
  return useInfiniteQuery({
    queryKey: qk.itemList(params),
    queryFn: ({ pageParam }) => listItems(params, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset,
    // New saves enrich in the background; refresh the list until they settle.
    refetchInterval: (query) =>
      query.state.data?.pages.some((p) => p.items.some(isFreshlyProcessing)) ? 4000 : false,
    // Range pagination can repeat an item when a new save shifts offsets; dedupe.
    select: (data) => {
      const seen = new Set<string>()
      return data.pages.flatMap((p) => p.items).filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
    },
  })
}

const POLL_WINDOW_MS = 90_000

export function isProcessing(item: Pick<SavedItem, 'processing_status'> | null | undefined): boolean {
  return item?.processing_status === 'pending' || item?.processing_status === 'processing'
}

/** Processing that started recently enough to be worth watching (updated_at moves on reprocess). */
function isFreshlyProcessing(item: Pick<SavedItem, 'processing_status' | 'updated_at'> | null | undefined): boolean {
  return isProcessing(item) && Date.now() - new Date(item?.updated_at ?? 0).getTime() < POLL_WINDOW_MS
}

/** Item detail; polls while background processing runs (bounded). */
export function useItem(id: string | undefined) {
  return useQuery({
    queryKey: qk.item(id ?? ''),
    queryFn: () => getItem(id ?? ''),
    enabled: !!id,
    refetchInterval: (query) => (isFreshlyProcessing(query.state.data) ? 2500 : false),
  })
}

export function useLibraryStats() {
  return useQuery({ queryKey: qk.stats(), queryFn: libraryStats })
}

export function useCreateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateItemInput) => createItem(input),
    onSuccess: ({ item, warnings }) => {
      track('save_created')
      // Fire-and-forget: the save is done; processing happens in the background.
      void requestProcessing(item.id)
      void queryClient.invalidateQueries({ queryKey: qk.items() })
      if (warnings.includes('tags') || warnings.includes('collections')) {
        void queryClient.invalidateQueries({ queryKey: qk.collections() })
        toast.message('Saved — but some details didn’t stick.', { description: 'You can add tags or collections from the item.' })
      }
    },
  })
}

type ListCache = InfiniteData<Page<SavedItem>, number>

/** Apply a patch to every cached copy of an item (lists + detail). */
function patchCachedItem(queryClient: QueryClient, id: string, patch: Partial<SavedItem>) {
  queryClient.setQueriesData<ListCache>({ queryKey: ['items', 'list'] }, (data) =>
    data
      ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })) }
      : data,
  )
  queryClient.setQueryData<SavedItem | null>(qk.item(id), (item) => (item ? { ...item, ...patch } : item))
}

function removeCachedItem(queryClient: QueryClient, id: string) {
  queryClient.setQueriesData<ListCache>({ queryKey: ['items', 'list'] }, (data) =>
    data ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) })) } : data,
  )
}

/** Optimistic item update with rollback via refetch on failure. */
export function useUpdateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ItemPatch }) => updateItem(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: qk.items() })
      patchCachedItem(queryClient, id, patch)
      if (patch.is_favorite) track('favorite_added')
    },
    onError: (error) => {
      toast.error(errorMessage(error))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.items() })
    },
  })
}

export function useToggleFavorite() {
  const update = useUpdateItem()
  return (item: Pick<SavedItem, 'id' | 'is_favorite'>) => update.mutate({ id: item.id, patch: { is_favorite: !item.is_favorite } })
}

export function useArchiveItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => updateItem(id, { is_archived: archived }),
    onMutate: async ({ id, archived }) => {
      await queryClient.cancelQueries({ queryKey: qk.items() })
      // Archiving moves the item between views; drop it from lists right away.
      removeCachedItem(queryClient, id)
      queryClient.setQueryData<SavedItem | null>(qk.item(id), (item) => (item ? { ...item, is_archived: archived } : item))
    },
    onSuccess: (_d, { archived }) => toast.success(archived ? 'Archived' : 'Restored'),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: qk.items() }),
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: (_d, id) => {
      removeCachedItem(queryClient, id)
      queryClient.removeQueries({ queryKey: qk.item(id) })
      void queryClient.invalidateQueries({ queryKey: qk.items() })
      void queryClient.invalidateQueries({ queryKey: qk.collections() })
      void queryClient.invalidateQueries({ queryKey: qk.tags() })
      toast.success('Deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useReprocessItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const ok = await requestProcessing(id, { force: true })
      if (!ok) throw new Error('reprocess failed')
    },
    onSuccess: (_d, id) => {
      patchCachedItem(queryClient, id, { processing_status: 'processing' })
      void queryClient.invalidateQueries({ queryKey: qk.item(id) })
      toast.success('Refreshing details…')
    },
    onError: () => toast.error('Couldn’t start processing. Please try again later.'),
  })
}
