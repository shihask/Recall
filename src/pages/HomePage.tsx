import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Brain, Plus } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorNotice } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/auth-context'
import { useCollections } from '@/features/collections/hooks'
import { useItems, useLibraryStats } from '@/features/saves/hooks'
import { ItemCard } from '@/features/saves/ItemCard'
import { ItemListSkeleton } from '@/features/saves/ItemList'
import { useSaveSheet } from '@/features/saves/save-sheet-context'
import { SearchBox } from '@/features/search/SearchBox'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { qk } from '@/lib/queryKeys'
import { errorMessage } from '@/services/supabase/errors'
import { recentFromCollections } from '@/services/supabase/items'
import type { SavedItem } from '@/types/domain'

function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 18) return 'Good afternoon'
  return 'Good evening'
}

const EXAMPLES = ['bike accessories', 'that recipe with chicken', 'photography tips', 'travel ideas']

function Shelf({ title, to, children }: { title: string; to?: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {to && (
          <Link to={to} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
            See all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function ItemShelf({ items }: { items: SavedItem[] }) {
  // Compact rows on phones; cards from sm up.
  const isDesktop = useIsDesktop()
  return (
    <ul className={isDesktop ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : '-mx-2.5 flex flex-col gap-1'}>
      {items.map((item) => (
        <li key={item.id}>
          <ItemCard item={item} layout={isDesktop ? 'grid' : 'list'} />
        </li>
      ))}
    </ul>
  )
}

export default function HomePage() {
  const { openSave } = useSaveSheet()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const recent = useItems({ view: 'all' })
  const favorites = useItems({ view: 'favorites' })
  const collections = useCollections()
  const stats = useLibraryStats()
  const exploring = useQuery({ queryKey: qk.recentInCollections(), queryFn: () => recentFromCollections(3) })
  const [params, setParams] = useSearchParams()

  // "Start saving" from onboarding lands here with ?save=1.
  useEffect(() => {
    if (params.get('save') !== '1') return
    setParams({}, { replace: true })
    openSave()
  }, [params, setParams, openSave])

  const meta = user?.user_metadata as Record<string, unknown> | undefined
  const fullName = [meta?.display_name, meta?.full_name, meta?.name].find((v): v is string => typeof v === 'string' && v.trim() !== '')
  const firstName = fullName?.trim().split(/\s+/)[0]
  const isEmpty = recent.isSuccess && recent.data.length === 0
  const search = (value: string) => value.trim() && navigate(`/search?q=${encodeURIComponent(value.trim())}`)

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            {greeting()}
            {firstName ? `, ${firstName}` : ''} 👋
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">What do you want to remember?</h1>
        </div>
        <Button onClick={() => openSave()} className="hidden sm:inline-flex">
          <Plus className="h-4 w-4" aria-hidden /> Save
        </Button>
      </header>

      <SearchBox className="mt-6" value={q} onChange={setQ} onSubmit={search} placeholder="Search your memory…" />
      {!isEmpty && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => search(ex)}
              className="rounded-full border border-line px-3 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {stats.data && stats.data.saves > 0 && (
        <p className="mt-6 text-sm text-muted">
          <Link to="/saves" className="hover:text-fg">
            <strong className="font-semibold text-fg">{stats.data.saves}</strong> {stats.data.saves === 1 ? 'Save' : 'Saves'}
          </Link>
          <span className="mx-2 text-line-strong">·</span>
          <Link to="/collections" className="hover:text-fg">
            <strong className="font-semibold text-fg">{stats.data.collections}</strong> {stats.data.collections === 1 ? 'Collection' : 'Collections'}
          </Link>
          <span className="mx-2 text-line-strong">·</span>
          <Link to="/favorites" className="hover:text-fg">
            <strong className="font-semibold text-fg">{stats.data.favorites}</strong> {stats.data.favorites === 1 ? 'Favorite' : 'Favorites'}
          </Link>
        </p>
      )}

      {recent.isError ? (
        <div className="mt-10">
          <ErrorNotice message={errorMessage(recent.error)} onRetry={() => void recent.refetch()} />
        </div>
      ) : isEmpty ? (
        <div className="mt-10">
          <EmptyState
            icon={Brain}
            title="Your memory is empty."
            description="Save your first interesting thing from the internet."
            action={
              <Button onClick={() => openSave()}>
                <Plus className="h-4 w-4" aria-hidden /> Save something
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <Shelf title="Recently Saved" to="/saves">
            {recent.isPending ? <ItemListSkeleton layout="list" count={3} /> : <ItemShelf items={recent.data.slice(0, 6)} />}
          </Shelf>

          {exploring.data && exploring.data.length > 0 && (
            <Shelf title="Continue Exploring" to="/collections">
              <ItemShelf items={exploring.data} />
            </Shelf>
          )}

          {favorites.data && favorites.data.length > 0 && (
            <Shelf title="Favorites" to="/favorites">
              <ItemShelf items={favorites.data.slice(0, 3)} />
            </Shelf>
          )}

          {collections.data && (
            <Shelf title="Collections" to="/collections">
              {collections.data.length === 0 ? (
                <p className="text-sm text-muted">Organize your saves into collections when you’re ready.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {collections.data.slice(0, 10).map((c) => (
                    <Link
                      key={c.id}
                      to={`/collections/${c.id}`}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm transition-colors hover:border-line-strong"
                    >
                      {c.icon && <span aria-hidden>{c.icon}</span>}
                      {c.name}
                      <span className="text-xs text-subtle">{c.item_count}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Shelf>
          )}
        </>
      )}
    </div>
  )
}
