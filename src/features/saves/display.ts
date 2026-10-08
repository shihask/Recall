import { displayHost } from '@shared/url.ts'
import { placeholderTitle } from '@/services/metadata/sourceLabels'
import type { SavedItem } from '@/types/domain'

export const SUMMARY_UNAVAILABLE = 'Summary unavailable.'

export function itemTitle(item: Pick<SavedItem, 'title' | 'source' | 'source_type' | 'url'>): string {
  return item.title || placeholderTitle(item.source, item.source_type, displayHost(item.url))
}

/** Best one-line description: AI summary, else the user's note, else page description. */
export function itemBlurb(item: Pick<SavedItem, 'ai_summary' | 'personal_note' | 'description'>): string | null {
  const summary = item.ai_summary && item.ai_summary !== SUMMARY_UNAVAILABLE ? item.ai_summary : null
  return summary || item.personal_note || item.description || null
}
