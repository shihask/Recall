import { describe, expect, it } from 'vitest'
import { existingInterestIds, INTERESTS, interestsToCreate } from './interests'

describe('interest collections', () => {
  it('creates only picked interests the user doesn’t already have (case/space-insensitive)', () => {
    const toCreate = interestsToCreate(['travel', 'food', 'art'], ['  travel ', 'Bike'])
    expect(toCreate.map((i) => i.name)).toEqual(['Food & Recipes', 'Art'])
  })
  it('marks interests that already exist', () => {
    expect([...existingInterestIds(['ART', 'Destinations'])]).toEqual(['art'])
  })
  it('has unique ids and names that fit collection limits', () => {
    expect(new Set(INTERESTS.map((i) => i.id)).size).toBe(INTERESTS.length)
    expect(new Set(INTERESTS.map((i) => i.name.toLowerCase())).size).toBe(INTERESTS.length)
    for (const i of INTERESTS) {
      expect(i.name.length).toBeLessThanOrEqual(60)
      expect([...i.icon].length).toBeLessThanOrEqual(16)
      expect(i.description.length).toBeLessThanOrEqual(500)
    }
  })
})
