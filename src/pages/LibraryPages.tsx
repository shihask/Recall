import { Archive, Brain, Heart } from 'lucide-react'
import { LibraryView } from '@/features/saves/LibraryView'

export function SavesPage() {
  return (
    <LibraryView
      params={{ view: 'all' }}
      title="All Saves"
      empty={{ icon: Brain, title: 'Your memory is empty.', description: 'Save your first interesting thing from the internet.', showSave: true }}
    />
  )
}

export function FavoritesPage() {
  return (
    <LibraryView
      params={{ view: 'favorites' }}
      title="Favorites"
      empty={{ icon: Heart, title: 'No favorites yet.', description: 'Tap the heart on anything you’ll want to come back to.' }}
    />
  )
}

export function ArchivePage() {
  return (
    <LibraryView
      params={{ view: 'archive' }}
      title="Archive"
      description="Hidden from browsing, never deleted. Restore anything any time."
      empty={{ icon: Archive, title: 'Nothing archived.', description: 'Archive saves you’re done with to keep your library calm.' }}
    />
  )
}
