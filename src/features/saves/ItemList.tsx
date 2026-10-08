import { LayoutGrid, List } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/misc'
import { useInView } from '@/hooks/useInView'
import { cn } from '@/lib/cn'
import type { SavedItem } from '@/types/domain'
import { ItemCard, type CardLayout } from './ItemCard'
import { LAYOUTS } from './useCardLayout'

export function LayoutToggle({ value, onChange }: { value: CardLayout; onChange: (v: CardLayout) => void }) {
  return (
    <div role="group" aria-label="Layout" className="inline-flex rounded-xl border border-line bg-surface p-0.5">
      {LAYOUTS.map((l) => {
        const Icon = l === 'grid' ? LayoutGrid : List
        return (
          <button
            key={l}
            type="button"
            onClick={() => onChange(l)}
            aria-pressed={value === l}
            aria-label={l === 'grid' ? 'Grid view' : 'List view'}
            className={cn('rounded-lg p-1.5 text-subtle transition-colors', value === l && 'bg-surface-2 text-fg')}
          >
            <Icon className="h-4 w-4" />
          </button>
        )
      })}
    </div>
  )
}

interface ItemListProps {
  items: SavedItem[]
  layout: CardLayout
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}

export function ItemList({ items, layout, hasMore, loadingMore, onLoadMore }: ItemListProps) {
  const [sentinel, inView] = useInView<HTMLDivElement>()

  // Infinite scroll, with the button below as a keyboard/no-JS-observer fallback.
  useEffect(() => {
    if (inView && hasMore && !loadingMore) onLoadMore?.()
  }, [inView, hasMore, loadingMore, onLoadMore])

  return (
    <div>
      <ul className={cn(layout === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-1')}>
        {items.map((item) => (
          <li key={item.id}>
            <ItemCard item={item} layout={layout} />
          </li>
        ))}
      </ul>
      {hasMore && (
        <div ref={sentinel} className="mt-6 flex justify-center">
          <Button variant="outline" onClick={onLoadMore} loading={loadingMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}

export function ItemListSkeleton({ layout, count = 6 }: { layout: CardLayout; count?: number }) {
  return (
    <ul aria-hidden className={cn(layout === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-3')}>
      {Array.from({ length: count }, (_, i) =>
        layout === 'grid' ? (
          <li key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <Skeleton className="aspect-[16/10] rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </li>
        ) : (
          <li key={i} className="flex gap-3.5 p-3">
            <Skeleton className="h-20 w-28 rounded-xl" />
            <div className="flex-1 space-y-2 py-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </li>
        ),
      )}
    </ul>
  )
}
