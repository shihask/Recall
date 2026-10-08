import { ArrowRight, Brain, ExternalLink, SearchX, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Thumbnail } from '@/components/Thumbnail'
import { ErrorNotice } from '@/components/ui/misc'
import { itemBlurb, itemTitle } from '@/features/saves/display'
import { ItemList, ItemListSkeleton, LayoutToggle } from '@/features/saves/ItemList'
import { useCardLayout } from '@/features/saves/useCardLayout'
import { FilterBar } from '@/features/search/FilterBar'
import { dateRange, filtersFromParams, paramsFromFilters, type DatePreset } from '@/features/search/filters'
import { useSearch } from '@/features/search/hooks'
import { SearchBox } from '@/features/search/SearchBox'
import { useDebounced } from '@/hooks/useDebounced'
import { describeSource, openOriginalLabel } from '@/services/metadata/sourceLabels'
import { confidentTopHit, type SearchHitItem } from '@/services/search/searchService'
import { errorMessage } from '@/services/supabase/errors'
import type { SearchFilters } from '@/types/database'
import { savedAgo } from '@/utils/dates'
import { safeHttpUrl } from '@/utils/safeUrl'

const EXAMPLES = [
  '3D printed bike accessories',
  'travel ideas for Kerala',
  'the recipe with chicken and cheese',
  'photography tips about golden hour',
  'that video about cleaning a helmet',
]

function FoundIt({ hit }: { hit: SearchHitItem }) {
  const { item } = hit
  const original = safeHttpUrl(item.url)
  const blurb = itemBlurb(item)
  return (
    <section aria-label="Best match" className="mb-8 rounded-3xl border border-accent/30 bg-accent-soft/40 p-4 sm:p-5">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-accent-soft-fg">
        <Sparkles className="h-4 w-4" aria-hidden /> I think I found it.
      </p>
      <div className="flex gap-4">
        <Thumbnail src={item.thumbnail_url} source={item.source} type={item.source_type} className="h-20 w-20 shrink-0 rounded-2xl sm:h-24 sm:w-32" />
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-lg leading-snug font-semibold tracking-tight">{itemTitle(item)}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {describeSource(item.source, item.source_type)} · {savedAgo(item.saved_at)}
          </p>
          {blurb && <p className="mt-1.5 line-clamp-2 hidden text-sm text-muted sm:block">{blurb}</p>}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {original && (
          <a
            href={original}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover sm:flex-none"
          >
            {openOriginalLabel(item.source)} <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
        <Link to={`/item/${item.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2">
          Details <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  )
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  // Parsed once on mount; afterwards local state is the source of truth and is mirrored to the URL.
  const [initial] = useState(() => filtersFromParams(params))
  const [text, setText] = useState(params.get('q') ?? '')
  const [filters, setFilters] = useState<SearchFilters>(initial.filters)
  const [datePreset, setDatePreset] = useState<DatePreset>(initial.datePreset)
  const [layout, setLayout] = useCardLayout()
  const inputRef = useRef<HTMLInputElement>(null)
  const q = useDebounced(text, 300)

  // Keep the URL shareable/back-button friendly without spamming history.
  useEffect(() => {
    setParams(paramsFromFilters(q, filters, datePreset), { replace: true })
  }, [q, filters, datePreset, setParams])

  const search = useSearch(q, filters)
  const top = q.trim() ? confidentTopHit(search.topPage) : null
  const rest = top ? search.hits.filter((h) => h.item.id !== top.item.id) : search.hits

  return (
    <div>
      <h1 className="sr-only">Search</h1>
      <SearchBox
        ref={inputRef}
        value={text}
        onChange={setText}
        onSubmit={() => inputRef.current?.blur()}
        autoFocus
        loading={search.isFetching && !search.loadingMore}
      />
      <div className="mt-3">
        <FilterBar
          filters={filters}
          datePreset={datePreset}
          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          onDatePreset={(preset) => {
            setDatePreset(preset)
            setFilters((f) => ({ ...f, ...dateRange(preset) }))
          }}
          onClear={() => {
            setDatePreset('any')
            setFilters({ sort: filters.sort })
          }}
        />
      </div>

      <div className="mt-8">
        {!search.enabled ? (
          <div className="mx-auto max-w-lg py-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">
              <Brain className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Describe what you remember.</h2>
            <p className="mt-1 text-sm text-muted">No exact title, creator or date needed.</p>
            <ul className="mt-6 flex flex-col items-center gap-2">
              {EXAMPLES.map((ex) => (
                <li key={ex}>
                  <button type="button" onClick={() => setText(ex)} className="rounded-full border border-line px-4 py-1.5 text-sm text-muted hover:border-line-strong hover:text-fg">
                    “{ex}”
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : search.isLoading ? (
          <ItemListSkeleton layout={layout} count={4} />
        ) : search.isError ? (
          <ErrorNotice message={errorMessage(search.error)} onRetry={() => void search.refetch()} />
        ) : search.hits.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">
              <SearchX className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Nothing found.</h2>
            <p className="mt-1 text-sm text-muted">{search.semanticPending ? 'Still looking by meaning…' : 'Try describing it differently.'}</p>
          </div>
        ) : (
          <>
            {top && <FoundIt hit={top} />}
            {rest.length > 0 && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm text-muted" aria-live="polite">
                    {top ? 'Other matches' : `${search.hits.length}${search.hasMore ? '+' : ''} ${search.hits.length === 1 ? 'match' : 'matches'}`}
                    {search.mode === 'hybrid' && <span className="text-subtle"> · by keyword and meaning</span>}
                  </p>
                  <LayoutToggle value={layout} onChange={setLayout} />
                </div>
                <ItemList
                  items={rest.map((h) => h.item)}
                  layout={layout}
                  hasMore={search.hasMore}
                  loadingMore={search.loadingMore}
                  onLoadMore={() => void search.loadMore()}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
