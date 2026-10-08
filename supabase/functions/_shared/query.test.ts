import { describe, expect, it } from 'vitest'
import { parseSearchIntent } from './query.ts'

describe('parseSearchIntent', () => {
  it.each([
    ['Show me the bike accessories I saved.', 'bike accessories', null, null],
    ['Find the Reel about a 3D printed phone holder.', '3D printed phone holder', null, 'reel'],
    ['What photography tips did I save?', 'photography tips', null, null],
    ['Show my travel ideas.', 'travel ideas', null, null],
    ['something about a motorcycle phone holder', 'motorcycle phone holder', null, null],
    ['that video about cleaning a helmet', 'cleaning a helmet', null, 'video'],
    ['I saw a Reel about a small device that cleans helmet visors', 'small device that cleans helmet visors', null, 'reel'],
    ['the recipe with chicken and cheese', 'recipe with chicken and cheese', null, null],
    ['travel ideas for Kerala', 'travel ideas for Kerala', null, null],
    ['that youtube short on golden hour', 'golden hour', 'youtube', 'short'],
    ['instagram reel phone mount', 'instagram reel phone mount', 'instagram', 'reel'],
  ] as const)('%j → %j', (input, terms, source, type) => {
    const r = parseSearchIntent(input)
    expect(r.terms).toBe(terms)
    expect(r.boostSource).toBe(source)
    expect(r.boostType).toBe(type)
    expect(r.original).toBe(input.replace(/\s+/g, ' ').trim())
  })

  it('never returns empty terms', () => {
    expect(parseSearchIntent('show me what I saved').terms).toBe('show me what I saved')
    expect(parseSearchIntent('  ').terms).toBe('')
    expect(parseSearchIntent('helmet').terms).toBe('helmet')
  })
})
