import { describe, expect, it } from 'vitest'
import { confidentTopHit, type SearchHitItem, type SearchPage } from '@/services/search/searchService'
import type { SavedItem } from '@/types/domain'
import { dateRange, filtersFromParams, paramsFromFilters } from './filters'

describe('filters ⇄ URL', () => {
  it('round-trips valid filters', () => {
    const p = new URLSearchParams('q=bike&source=instagram&category=DIY&fav=1&sort=newest&date=month&tag=1b4e28ba-2fa1-11d2-883f-0016d3cca427')
    const { filters, datePreset } = filtersFromParams(p)
    expect(filters.source).toBe('instagram')
    expect(filters.category).toBe('DIY')
    expect(filters.favorite).toBe(true)
    expect(filters.sort).toBe('newest')
    expect(filters.tag_id).toBe('1b4e28ba-2fa1-11d2-883f-0016d3cca427')
    expect(datePreset).toBe('month')
    expect(paramsFromFilters('bike', filters, datePreset).toString()).toBe(
      'q=bike&source=instagram&category=DIY&tag=1b4e28ba-2fa1-11d2-883f-0016d3cca427&fav=1&sort=newest&date=month',
    )
  })

  it('drops invalid or injected values', () => {
    const { filters, datePreset } = filtersFromParams(new URLSearchParams("source=myspace&category=Hacking&collection=1;drop table&date=forever"))
    expect(filters.source).toBeNull()
    expect(filters.category).toBeNull()
    expect(filters.collection_id).toBeNull()
    expect(datePreset).toBe('any')
  })

  it('date presets are day-stable', () => {
    const a = dateRange('week', new Date('2026-10-08T01:00:00Z'))
    const b = dateRange('week', new Date('2026-10-08T23:00:00Z'))
    expect(a).toEqual(b)
    expect(a.from).toBe('2026-10-01T00:00:00.000Z')
    expect(dateRange('older', new Date('2026-10-08T12:00:00Z')).to).toBe('2025-10-07T00:00:00.000Z')
    expect(dateRange('any')).toEqual({ from: null, to: null })
  })
})

const hit = (id: string, rank: number, similarity: number | null = null, keywordMatch = true): SearchHitItem => ({
  item: { id } as SavedItem,
  rank,
  similarity,
  keywordMatch,
})
const page = (mode: SearchPage['mode'], hits: SearchHitItem[]): SearchPage => ({ mode, hits, nextOffset: null })

describe('confidentTopHit', () => {
  it('is confident about a single clear keyword match', () => {
    expect(confidentTopHit(page('keyword', [hit('a', 0.4)]))?.item.id).toBe('a')
  })
  it('stays quiet when results are close', () => {
    expect(confidentTopHit(page('keyword', [hit('a', 0.3), hit('b', 0.28)]))).toBeNull()
    expect(confidentTopHit(page('hybrid', [hit('a', 0.03, 0.9), hit('b', 0.029, 0.89)]))).toBeNull()
  })
  it('trusts strong semantic matches with a margin', () => {
    expect(confidentTopHit(page('hybrid', [hit('a', 0.032, 0.88, false), hit('b', 0.016, 0.7)]))?.item.id).toBe('a')
    expect(confidentTopHit(page('hybrid', [hit('a', 0.032, 0.7, false)]))).toBeNull()
  })
  it('handles empty input', () => {
    expect(confidentTopHit(null)).toBeNull()
    expect(confidentTopHit(page('keyword', []))).toBeNull()
  })
})
