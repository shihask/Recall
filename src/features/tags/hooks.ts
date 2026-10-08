import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { qk } from '@/lib/queryKeys'
import { errorMessage } from '@/services/supabase/errors'
import { removeTag, requestProcessing, setUserTags } from '@/services/supabase/items'
import { deleteTag, getTag, listTags, renameTag } from '@/services/supabase/tags'

export function useTags() {
  return useQuery({ queryKey: qk.tags(), queryFn: listTags, staleTime: 60_000 })
}

export function useTag(id: string | undefined) {
  return useQuery({ queryKey: qk.tag(id ?? ''), queryFn: () => getTag(id ?? ''), enabled: !!id })
}

function useInvalidateAfterTagChange() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.items() })
    void queryClient.invalidateQueries({ queryKey: qk.tags() })
  }
}

export function useAddItemTags() {
  const invalidate = useInvalidateAfterTagChange()
  return useMutation({
    mutationFn: async ({ itemId, names }: { itemId: string; names: string[] }) => {
      await setUserTags(itemId, names)
      // Tags feed the embedding; refresh it in the background.
      void requestProcessing(itemId, { jobType: 'embed' })
    },
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useRemoveItemTag() {
  const invalidate = useInvalidateAfterTagChange()
  return useMutation({
    mutationFn: async ({ itemId, tagId }: { itemId: string; tagId: string }) => {
      await removeTag(itemId, tagId)
      void requestProcessing(itemId, { jobType: 'embed' })
    },
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useRenameTag() {
  const invalidate = useInvalidateAfterTagChange()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameTag(id, name),
    onSuccess: invalidate,
  })
}

export function useDeleteTag() {
  const invalidate = useInvalidateAfterTagChange()
  return useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => {
      invalidate()
      toast.success('Tag deleted')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}
