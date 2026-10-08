import { describe, expect, it } from 'vitest'
import { itemBlurb, itemTitle } from '@/features/saves/display'
import { describeSource, openOriginalLabel } from '@/services/metadata/sourceLabels'
import { toAppError } from '@/services/supabase/errors'
import { normalizeTagNames } from '@/services/supabase/tags'
import { savedAgo } from '@/utils/dates'
import { safeHttpUrl } from '@/utils/safeUrl'

describe('source labels', () => {
  it('describes platform content', () => {
    expect(describeSource('instagram', 'reel')).toBe('Instagram Reel')
    expect(describeSource('youtube', 'short')).toBe('YouTube Short')
    expect(describeSource('x', 'post')).toBe('X post')
    expect(describeSource('reddit', 'link')).toBe('Reddit')
    expect(describeSource('website', 'link')).toBe('Website')
    expect(describeSource('website', 'pdf')).toBe('PDF')
  })
  it('labels the open-original action', () => {
    expect(openOriginalLabel('instagram')).toBe('Open in Instagram')
    expect(openOriginalLabel('website')).toBe('Open Original')
  })
})

describe('item display', () => {
  const base = { source: 'instagram', source_type: 'reel', url: 'https://www.instagram.com/reel/abc/' } as const
  it('falls back to a platform placeholder title when metadata is unavailable', () => {
    expect(itemTitle({ ...base, title: null })).toBe('Instagram Reel')
    expect(itemTitle({ source: 'website', source_type: 'link', url: 'https://www.example.com/x', title: null })).toBe('example.com')
    expect(itemTitle({ ...base, title: 'Phone mount' })).toBe('Phone mount')
  })
  it('prefers summary, then note, then description — never the unavailable marker', () => {
    expect(itemBlurb({ ai_summary: 'S', personal_note: 'N', description: 'D' })).toBe('S')
    expect(itemBlurb({ ai_summary: 'Summary unavailable.', personal_note: 'N', description: 'D' })).toBe('N')
    expect(itemBlurb({ ai_summary: null, personal_note: null, description: 'D' })).toBe('D')
    expect(itemBlurb({ ai_summary: null, personal_note: null, description: null })).toBeNull()
  })
})

describe('normalizeTagNames', () => {
  it('trims, collapses spaces, dedupes case-insensitively, drops empties, caps length', () => {
    expect(normalizeTagNames(['  3D   Printing ', '3d printing', '', 'DIY', 'a'.repeat(60)])).toEqual(['3D Printing', 'DIY', 'a'.repeat(40)])
  })
})

describe('toAppError', () => {
  it('maps network failures to the calm copy', () => {
    expect(toAppError(new TypeError('Failed to fetch')).message).toBe('Couldn’t connect. Please try again.')
  })
  it('maps unique violations and auth', () => {
    expect(toAppError({ code: '23505', message: 'dup' }).code).toBe('conflict')
    expect(toAppError({ status: 401, message: 'JWT expired' }).code).toBe('auth')
  })
  it('never leaks raw server text by default', () => {
    expect(toAppError({ message: 'relation "x" does not exist' }).message).toBe('Something went wrong. Please try again.')
  })
})

describe('savedAgo', () => {
  const now = new Date('2026-10-08T12:00:00Z')
  it('reads naturally', () => {
    expect(savedAgo('2026-10-08T08:00:00Z', now)).toBe('Saved today')
    expect(savedAgo('2026-10-07T08:00:00Z', now)).toBe('Saved yesterday')
    expect(savedAgo('2026-09-26T12:00:00Z', now)).toMatch(/^Saved 12 days ago$/)
  })
})

describe('safeHttpUrl', () => {
  it('only allows http(s)', () => {
    expect(safeHttpUrl('https://a.com/x')).toBe('https://a.com/x')
    expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeHttpUrl('data:image/png;base64,xx')).toBeUndefined()
    expect(safeHttpUrl(null)).toBeUndefined()
    expect(safeHttpUrl('not a url')).toBeUndefined()
  })
})
