import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dismissSuggestion, suggestedCollection } from './suggestion'

// Node test environment: a minimal localStorage.
beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  })
})

const item = (metadata: unknown, collections: { id: string; name: string; icon: null }[] = []) =>
  ({ id: 'item-1', metadata, collections }) as Parameters<typeof suggestedCollection>[0]

describe('suggested collection', () => {
  it('offers the AI’s name for an unfiled save', () => {
    expect(suggestedCollection(item({ ai_suggested_collection: { name: 'Video Editing' } }))).toBe('Video Editing')
  })
  it('offers nothing once the save is in a collection', () => {
    expect(suggestedCollection(item({ ai_suggested_collection: { name: 'Video Editing' } }, [{ id: 'c', name: 'Bikes', icon: null }]))).toBeNull()
  })
  it('ignores missing or malformed suggestions', () => {
    expect(suggestedCollection(item({}))).toBeNull()
    expect(suggestedCollection(item({ ai_suggested_collection: 'Video Editing' }))).toBeNull()
    expect(suggestedCollection(item({ ai_suggested_collection: { name: '  ' } }))).toBeNull()
    expect(suggestedCollection(item(null))).toBeNull()
  })
  it('stops offering after "Not now"', () => {
    dismissSuggestion('item-1')
    expect(suggestedCollection(item({ ai_suggested_collection: { name: 'Video Editing' } }))).toBeNull()
  })
})
