// Starter collections offered at onboarding (and from the Collections page).
// Descriptions matter: AI auto-filing reads them to decide where a save goes.

export interface Interest {
  id: string
  name: string
  icon: string
  description: string
}

export const INTERESTS: Interest[] = [
  { id: 'travel', name: 'Travel', icon: '✈️', description: 'Places to visit, trips, stays and travel tips' },
  { id: 'food', name: 'Food & Recipes', icon: '🍳', description: 'Recipes, restaurants, street food and cooking ideas' },
  { id: 'fitness', name: 'Fitness', icon: '🏋️', description: 'Workouts, exercises, yoga and training plans' },
  { id: 'health', name: 'Health', icon: '🌱', description: 'Health, nutrition, wellbeing and mental health' },
  { id: 'tech', name: 'Tech', icon: '💻', description: 'Gadgets, apps, AI and technology news' },
  { id: 'coding', name: 'Programming', icon: '🧑‍💻', description: 'Coding tutorials, developer tools and software engineering' },
  { id: 'art', name: 'Art', icon: '🎨', description: 'Drawing, painting, illustration and creative inspiration' },
  { id: 'design', name: 'Design', icon: '✏️', description: 'UI/UX, graphic design, typography and branding' },
  { id: 'photography', name: 'Photography', icon: '📸', description: 'Photography tips, gear, editing and photo spots' },
  { id: 'education', name: 'Education', icon: '📚', description: 'Courses, study tips, explainers and things to learn' },
  { id: 'finance', name: 'Finance', icon: '💰', description: 'Investing, saving, budgeting, stocks and money tips' },
  { id: 'business', name: 'Business', icon: '💼', description: 'Startups, marketing, entrepreneurship and careers' },
  { id: 'home', name: 'Home & DIY', icon: '🏠', description: 'Home decor, DIY projects, tools and gardening' },
  { id: 'shopping', name: 'Shopping', icon: '🛒', description: 'Products to buy, deals and wishlists' },
  { id: 'fashion', name: 'Fashion', icon: '👗', description: 'Outfits, style ideas, clothing and beauty' },
  { id: 'movies', name: 'Movies & Shows', icon: '🎬', description: 'Movies, series, trailers and what to watch' },
  { id: 'music', name: 'Music', icon: '🎵', description: 'Songs, artists, playlists and instruments' },
  { id: 'books', name: 'Books', icon: '📖', description: 'Books to read, reviews and reading lists' },
  { id: 'gaming', name: 'Gaming', icon: '🎮', description: 'Video games, gameplay, tips and gaming gear' },
  { id: 'vehicles', name: 'Cars & Bikes', icon: '🏍️', description: 'Cars, motorcycles, rides, mods and accessories' },
  { id: 'sports', name: 'Sports', icon: '⚽', description: 'Sports highlights, teams, matches and athletes' },
  { id: 'parenting', name: 'Parenting', icon: '🧸', description: 'Parenting tips, kids activities and family ideas' },
]

const key = (name: string) => name.replace(/\s+/g, ' ').trim().toLowerCase()

/** The picked interests that don't already exist as a collection (names are unique per user, case-insensitively). */
export function interestsToCreate(selectedIds: Iterable<string>, existingNames: string[]): Interest[] {
  const existing = new Set(existingNames.map(key))
  const picked = new Set(selectedIds)
  return INTERESTS.filter((i) => picked.has(i.id) && !existing.has(key(i.name)))
}

/** Interest ids already present as collections, to show them as added. */
export function existingInterestIds(existingNames: string[]): Set<string> {
  const existing = new Set(existingNames.map(key))
  return new Set(INTERESTS.filter((i) => existing.has(key(i.name))).map((i) => i.id))
}
