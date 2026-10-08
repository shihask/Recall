import { CATEGORIES, type Category } from '@shared/categories.ts'
import { SOURCES, type Source } from '@shared/url.ts'
import type { SearchFilters } from '@/types/database'

export const DATE_PRESETS = [
  { value: 'any', label: 'Any time', days: null },
  { value: 'week', label: 'Past week', days: 7 },
  { value: 'month', label: 'Past month', days: 31 },
  { value: '3months', label: 'Past 3 months', days: 92 },
  { value: 'year', label: 'Past year', days: 366 },
  { value: 'older', label: 'Over a year ago', days: -366 },
] as const

export type DatePreset = (typeof DATE_PRESETS)[number]['value']

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function dateRange(preset: DatePreset, now = new Date()): Pick<SearchFilters, 'from' | 'to'> {
  const days = DATE_PRESETS.find((p) => p.value === preset)?.days ?? null
  if (days === null) return { from: null, to: null }
  // Rounded to the UTC day so the value (and the query key built from it) is
  // stable across renders instead of changing every millisecond.
  const DAY = 86_400_000
  const edge = new Date(Math.floor((now.getTime() - Math.abs(days) * DAY) / DAY) * DAY).toISOString()
  return days > 0 ? { from: edge, to: null } : { from: null, to: edge }
}

/** URL ⇄ filters. Unknown/invalid values are dropped, never passed to SQL. */
export function filtersFromParams(params: URLSearchParams): { filters: SearchFilters; datePreset: DatePreset } {
  const source = params.get('source')
  const category = params.get('category')
  const collection = params.get('collection')
  const tag = params.get('tag')
  const date = params.get('date')
  const datePreset: DatePreset = DATE_PRESETS.some((p) => p.value === date) ? (date as DatePreset) : 'any'
  return {
    datePreset,
    filters: {
      source: source && (SOURCES as readonly string[]).includes(source) ? (source as Source) : null,
      category: category && (CATEGORIES as readonly string[]).includes(category) ? (category as Category) : null,
      collection_id: collection && UUID.test(collection) ? collection : null,
      tag_id: tag && UUID.test(tag) ? tag : null,
      favorite: params.get('fav') === '1' || null,
      include_archived: params.get('archived') === '1' || null,
      sort: params.get('sort') === 'newest' ? 'newest' : 'relevance',
      ...dateRange(datePreset),
    },
  }
}

export function paramsFromFilters(q: string, filters: SearchFilters, datePreset: DatePreset): URLSearchParams {
  const p = new URLSearchParams()
  if (q.trim()) p.set('q', q.trim())
  if (filters.source) p.set('source', filters.source)
  if (filters.category) p.set('category', filters.category)
  if (filters.collection_id) p.set('collection', filters.collection_id)
  if (filters.tag_id) p.set('tag', filters.tag_id)
  if (filters.favorite) p.set('fav', '1')
  if (filters.include_archived) p.set('archived', '1')
  if (filters.sort === 'newest') p.set('sort', 'newest')
  if (datePreset !== 'any') p.set('date', datePreset)
  return p
}
