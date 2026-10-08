import { Check, Loader2, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Thumbnail } from '@/components/Thumbnail'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { ErrorNotice, Skeleton } from '@/components/ui/misc'
import { itemTitle } from '@/features/saves/display'
import { useItems } from '@/features/saves/hooks'
import { useSearch } from '@/features/search/hooks'
import { useDebounced } from '@/hooks/useDebounced'
import { cn } from '@/lib/cn'
import { describeSource } from '@/services/metadata/sourceLabels'
import { errorMessage } from '@/services/supabase/errors'
import type { CollectionRow } from '@/types/database'
import type { SavedItem } from '@/types/domain'
import { useToggleItemCollection } from './hooks'

interface AddSavesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collection: Pick<CollectionRow, 'id' | 'name'>
}

/** Pick existing saves (reels, posts, links…) to add to — or remove from — a collection. */
export function AddSavesDialog({ open, onOpenChange, collection }: AddSavesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Add to ${collection.name}`} description="Tap a save to add it. Tap again to remove it.">
      {open && <AddSaves collection={collection} />}
    </Dialog>
  )
}

function AddSaves({ collection }: { collection: AddSavesDialogProps['collection'] }) {
  const [q, setQ] = useState('')
  const query = useDebounced(q.trim(), 250)
  const recent = useItems({ view: 'all' })
  const search = useSearch(query, {})
  const toggle = useToggleItemCollection()
  // Optimistic membership so taps feel instant; the refetched item wins once it lands.
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map())

  const searching = query.length > 0
  const items: SavedItem[] = searching ? search.hits.map((h) => h.item) : (recent.data ?? [])
  const isLoading = searching ? search.isLoading : recent.isPending
  const isError = searching ? search.isError : recent.isError
  const error = searching ? search.error : recent.error
  const hasMore = searching ? search.hasMore : recent.hasNextPage
  const loadingMore = searching ? search.loadingMore : recent.isFetchingNextPage
  const loadMore = () => void (searching ? search.loadMore() : recent.fetchNextPage())

  function onToggle(item: SavedItem, add: boolean) {
    setOverrides((m) => new Map(m).set(item.id, add))
    toggle.mutate(
      { itemId: item.id, collectionId: collection.id, add },
      { onError: () => setOverrides((m) => new Map(m).set(item.id, !add)) },
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your saves"
          aria-label="Search your saves"
          className="pl-10"
          enterKeyHint="search"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorNotice message={errorMessage(error)} />
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{searching ? 'No saves match that.' : 'Nothing saved yet.'}</p>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {items.map((item) => {
            const inThis = overrides.get(item.id) ?? item.collections.some((c) => c.id === collection.id)
            const elsewhere = item.collections.filter((c) => c.id !== collection.id)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onToggle(item, !inThis)}
                  aria-pressed={inThis}
                  className={cn('flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors', inThis ? 'bg-accent-soft' : 'hover:bg-surface-2')}
                >
                  <Thumbnail src={item.thumbnail_url} source={item.source} type={item.source_type} className="h-12 w-12 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm leading-snug font-medium">{itemTitle(item)}</span>
                    <span className="mt-0.5 block truncate text-xs text-subtle">
                      {describeSource(item.source, item.source_type)}
                      {elsewhere.length > 0 && ` · in ${elsewhere.map((c) => c.name).join(', ')}`}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                      inThis ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong text-subtle',
                    )}
                    aria-hidden
                  >
                    {inThis ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {hasMore && !isLoading && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
        >
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Show more
        </button>
      )}
    </div>
  )
}
