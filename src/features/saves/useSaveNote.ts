import { NEEDS_NOTE } from '@shared/processing.ts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { qk } from '@/lib/queryKeys'
import { errorMessage } from '@/services/supabase/errors'
import { requestProcessing, updateItem } from '@/services/supabase/items'
import type { SavedItem } from '@/types/domain'

/**
 * Items with no public preview (most Instagram/Facebook saves) get their
 * category, tags and search meaning from the user's own words — so a new or
 * changed note re-runs full enrichment for them. Everything else only needs
 * its embedding refreshed.
 */
export function noteDrivesEnrichment(item: Pick<SavedItem, 'processing_status' | 'processing_error' | 'title'>): boolean {
  return item.processing_error === NEEDS_NOTE || (item.processing_status === 'partial' && !item.title)
}

/** True when the item has nothing to recall it by yet — prompt for a note. */
export function needsNote(item: Pick<SavedItem, 'processing_status' | 'processing_error' | 'title' | 'personal_note'>): boolean {
  return !item.personal_note?.trim() && noteDrivesEnrichment(item)
}

const SOURCE_NAMES: Partial<Record<SavedItem['source'], string>> = { instagram: 'Instagram', facebook: 'Facebook', x: 'X', reddit: 'Reddit' }

/** "Instagram doesn't share previews with other apps." */
export function previewlessTitle(source: SavedItem['source']): string {
  const name = SOURCE_NAMES[source]
  return name ? `${name} doesn’t share previews with other apps.` : 'This page didn’t share a preview.'
}

export function useSaveNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ item, note }: { item: SavedItem; note: string | null }) => {
      await updateItem(item.id, { personal_note: note })
      // The function claims the job before answering, so a refetch right after
      // shows "processing" and the item view keeps polling until it's done.
      await requestProcessing(item.id, noteDrivesEnrichment(item) ? { force: true } : { jobType: 'embed' })
    },
    onSettled: (_d, _e, { item }) => {
      void queryClient.invalidateQueries({ queryKey: qk.item(item.id) })
      void queryClient.invalidateQueries({ queryKey: ['items', 'list'] })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}
