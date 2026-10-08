// What a saved item "means" for semantic search: the fields a person would
// remember it by. Kept short (gte-small reads ~512 tokens).
import { SUMMARY_UNAVAILABLE } from './enrichment.ts'

export interface EmbeddableItem {
  title: string | null
  description: string | null
  ai_summary: string | null
  ai_category: string | null
  personal_note: string | null
  author_name: string | null
  content_text: string | null
  sourceLabel: string
  tags: string[]
}

export function buildEmbeddingText(item: EmbeddableItem): string {
  const parts = [
    item.title,
    item.ai_summary && item.ai_summary !== SUMMARY_UNAVAILABLE ? item.ai_summary : null,
    item.personal_note ? `Note: ${item.personal_note}` : null,
    item.tags.length ? `Tags: ${item.tags.join(', ')}` : null,
    item.ai_category ? `Category: ${item.ai_category}` : null,
    item.description?.slice(0, 400) ?? null,
    `${item.sourceLabel}${item.author_name ? ` by ${item.author_name}` : ''}`,
    item.content_text?.slice(0, 600) ?? null,
  ]
  return parts
    .filter((p): p is string => !!p && !!p.trim())
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .slice(0, 2000)
}
