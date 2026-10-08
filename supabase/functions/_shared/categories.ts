// Controlled category list (product spec §22). Mirrored by the CHECK
// constraint on saved_items.ai_category — change both together.
export const CATEGORIES = [
  'Technology', 'Programming', 'Business', 'Finance', 'Travel', 'Food', 'Recipes',
  'Health', 'Fitness', 'Photography', 'DIY', 'Home', 'Shopping', 'Vehicles',
  'Motorcycles', 'Education', 'Entertainment', 'Lifestyle', 'Design', 'Other',
] as const

export type Category = (typeof CATEGORIES)[number]

const BY_LOWER = new Map<string, Category>(CATEGORIES.map((c) => [c.toLowerCase(), c]))

/** Map free text to a controlled category; anything unknown becomes "Other". */
export function toCategory(value: unknown): Category {
  if (typeof value !== 'string') return 'Other'
  return BY_LOWER.get(value.trim().toLowerCase()) ?? 'Other'
}
