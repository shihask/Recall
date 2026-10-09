import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadedAt, markDownloaded } from './gallery'

// Node test environment: a minimal localStorage.
beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
})

describe('downloaded-to-gallery memory', () => {
  it('remembers per item, with the date', () => {
    expect(downloadedAt('a')).toBeNull()
    markDownloaded('a')
    expect(downloadedAt('a')).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(downloadedAt('b')).toBeNull()
  })
  it('keeps only the most recent 500', () => {
    for (let i = 0; i < 505; i++) markDownloaded(`item-${i}`)
    expect(downloadedAt('item-0')).toBeNull()
    expect(downloadedAt('item-504')).not.toBeNull()
  })
  it('survives corrupt storage', () => {
    localStorage.setItem('recall.gallery.downloaded', 'not json')
    expect(downloadedAt('a')).toBeNull()
    markDownloaded('a')
    expect(downloadedAt('a')).not.toBeNull()
  })
})
