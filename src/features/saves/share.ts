import { toast } from 'sonner'
import type { SavedItem } from '@/types/domain'

/** Share the ORIGINAL link (Recall items are private; there's nothing public to share). */
export async function shareItem(item: Pick<SavedItem, 'url' | 'title'>): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ url: item.url, title: item.title ?? undefined })
      return
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') return
      // fall through to copy
    }
  }
  try {
    await navigator.clipboard.writeText(item.url)
    toast.success('Link copied')
  } catch {
    toast.error('Couldn’t copy the link.')
  }
}
