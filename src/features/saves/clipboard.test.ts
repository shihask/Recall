import { describe, expect, it } from 'vitest'
import { shouldOffer } from './clipboard'

describe('copied link detection', () => {
  it('offers a copied link only once', () => {
    expect(shouldOffer('https://www.instagram.com/reel/A/', null)).toBe(true)
    expect(shouldOffer('https://www.instagram.com/reel/A/', 'https://www.instagram.com/reel/A/')).toBe(false)
    expect(shouldOffer('https://youtu.be/B', 'https://www.instagram.com/reel/A/')).toBe(true)
    expect(shouldOffer(null, null)).toBe(false)
  })
})
