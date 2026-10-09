import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { track } from '@/lib/analytics'
import { qk } from '@/lib/queryKeys'
import {
  createCollection,
  deleteCollection,
  getCollection,
  listCollections,
  updateCollection,
  type CollectionInput,
} from '@/services/supabase/collections'
import { AppError, errorMessage } from '@/services/supabase/errors'
import type { Interest } from './interests'
import { addToCollections, removeFromCollection } from '@/services/supabase/items'

export function useCollections() {
  return useQuery({ queryKey: qk.collections(), queryFn: listCollections })
}

export function useCollection(id: string | undefined) {
  return useQuery({ queryKey: qk.collection(id ?? ''), queryFn: () => getCollection(id ?? ''), enabled: !!id })
}

export function useCreateCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CollectionInput) => createCollection(input),
    onSuccess: () => {
      track('collection_created')
      void queryClient.invalidateQueries({ queryKey: qk.collections() })
    },
  })
}

/** Create starter collections from picked interests. Ones that already exist are skipped. */
export function useCreateInterestCollections() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (interests: Interest[]) => {
      let created = 0
      // One at a time: a parallel burst could race the per-user unique-name check.
      for (const i of interests) {
        try {
          await createCollection({ name: i.name, icon: i.icon, description: i.description })
          created++
        } catch (error) {
          if (!(error instanceof AppError && error.code === 'conflict')) throw error
        }
      }
      return created
    },
    onSuccess: (created) => {
      if (created) track('collection_created')
      void queryClient.invalidateQueries({ queryKey: qk.collections() })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useUpdateCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CollectionInput }) => updateCollection(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.collections() })
      // Items embed the collection name/icon.
      void queryClient.invalidateQueries({ queryKey: qk.items() })
    },
  })
}

export function useDeleteCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.collections() })
      void queryClient.invalidateQueries({ queryKey: qk.items() })
      toast.success('Collection deleted. Your saves are still in your library.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

/** Add/remove one item to/from one collection. */
export function useToggleItemCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, collectionId, add }: { itemId: string; collectionId: string; add: boolean }) =>
      add ? addToCollections(itemId, [collectionId]) : removeFromCollection(itemId, collectionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.items() })
      void queryClient.invalidateQueries({ queryKey: qk.collections() })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}
