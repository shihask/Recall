// "Start a new collection?" — when the AI found no existing collection for a
// save, it leaves a name in metadata.ai_suggested_collection (see the
// server's processor). The app offers to create it; "Not now" is remembered
// per device (clients can't write item metadata).
import type { SavedItem } from '@/types/domain'

const DISMISSED_KEY = 'recall.collection-suggestions.dismissed'
const MAX_REMEMBERED = 300

function dismissedIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function dismissSuggestion(itemId: string) {
  try {
    const ids = dismissedIds().filter((id) => id !== itemId)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids, itemId].slice(-MAX_REMEMBERED)))
  } catch {
    // Blocked storage: it'll just be offered again next time.
  }
}

/** The new collection to offer for this save, or null (already filed, nothing suggested, or dismissed). */
export function suggestedCollection(item: Pick<SavedItem, 'id' | 'metadata' | 'collections'>): string | null {
  if (item.collections.length) return null
  const meta = item.metadata
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const suggestion = meta.ai_suggested_collection
  if (!suggestion || typeof suggestion !== 'object' || Array.isArray(suggestion)) return null
  const name = typeof suggestion.name === 'string' ? suggestion.name.trim() : ''
  if (!name || dismissedIds().includes(item.id)) return null
  return name
}
