// Privacy-first product events. Deliberately a no-op in V1: event NAMES only,
// never URLs, titles, notes or queries. Wire to a privacy-respecting sink
// later without touching call sites.
export type ProductEvent =
  | 'save_created'
  | 'search_performed'
  | 'item_opened'
  | 'collection_created'
  | 'favorite_added'

export function track(_event: ProductEvent): void {
  // intentionally empty
}
