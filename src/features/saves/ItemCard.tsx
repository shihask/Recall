import { displayHost } from '@shared/url.ts'
import { Heart, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SourceIcon } from '@/components/SourceIcon'
import { Thumbnail } from '@/components/Thumbnail'
import { cn } from '@/lib/cn'
import { describeSource } from '@/services/metadata/sourceLabels'
import type { SavedItem } from '@/types/domain'
import { savedAgo } from '@/utils/dates'
import { itemBlurb, itemTitle } from './display'
import { isProcessing, useToggleFavorite } from './hooks'
import { ItemMenu } from './ItemMenu'

export type CardLayout = 'grid' | 'list'

function FavoriteButton({ item, className }: { item: SavedItem; className?: string }) {
  const toggle = useToggleFavorite()
  return (
    <button
      type="button"
      onClick={() => toggle(item)}
      aria-pressed={item.is_favorite}
      aria-label={item.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
      className={cn(
        'relative z-10 rounded-lg p-1.5 transition-colors hover:bg-surface-2',
        item.is_favorite ? 'text-danger' : 'text-subtle hover:text-fg',
        className,
      )}
    >
      <Heart className={cn('h-[18px] w-[18px]', item.is_favorite && 'fill-current')} />
    </button>
  )
}

function SourceLine({ item }: { item: SavedItem }) {
  const host = displayHost(item.url)
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
      <SourceIcon source={item.source} type={item.source_type} className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        {item.source === 'website' ? host : describeSource(item.source, item.source_type)}
        {item.author_name && <span className="text-subtle"> · {item.author_name}</span>}
      </span>
      {isProcessing(item) && (
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-subtle">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Processing
        </span>
      )}
    </p>
  )
}

function TagChips({ item, max = 3 }: { item: SavedItem; max?: number }) {
  if (item.tags.length === 0) return null
  const shown = item.tags.slice(0, max)
  const rest = item.tags.length - shown.length
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((t) => (
        <span key={t.id} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
          {t.name}
        </span>
      ))}
      {rest > 0 && <span className="px-1 py-0.5 text-xs text-subtle">+{rest}</span>}
    </div>
  )
}

/**
 * Whole card is clickable via a stretched title link; the favorite and menu
 * buttons sit above it (z-10) so there are no nested interactive elements.
 */
export function ItemCard({ item, layout = 'grid' }: { item: SavedItem; layout?: CardLayout }) {
  const title = itemTitle(item)
  const blurb = itemBlurb(item)

  if (layout === 'list') {
    return (
      <article className="group relative flex gap-3.5 rounded-2xl border border-transparent p-2.5 transition-colors hover:border-line hover:bg-surface sm:p-3">
        <Thumbnail src={item.thumbnail_url} source={item.source} type={item.source_type} className="h-[72px] w-[72px] shrink-0 rounded-xl sm:h-20 sm:w-28" />
        <div className="min-w-0 flex-1">
          <SourceLine item={item} />
          <h3 className="mt-1 line-clamp-2 text-[15px] leading-snug font-medium">
            <Link to={`/item/${item.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent">
              {title}
            </Link>
          </h3>
          {blurb && <p className="mt-0.5 line-clamp-1 text-sm text-muted">{blurb}</p>}
          <p className="mt-1 text-xs text-subtle">{savedAgo(item.saved_at)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-center">
          <FavoriteButton item={item} />
          <ItemMenu item={item} />
        </div>
      </article>
    )
  }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-soft">
      <Thumbnail src={item.thumbnail_url} source={item.source} type={item.source_type} className="aspect-[16/10] w-full" iconClassName="h-8 w-8" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <SourceLine item={item} />
        <h3 className="line-clamp-2 leading-snug font-medium">
          <Link to={`/item/${item.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent">
            {title}
          </Link>
        </h3>
        {blurb && <p className="line-clamp-2 text-sm text-muted">{blurb}</p>}
        <TagChips item={item} />
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="text-xs text-subtle">{savedAgo(item.saved_at)}</span>
          <div className="-mr-1.5 flex items-center">
            <FavoriteButton item={item} />
            <ItemMenu item={item} />
          </div>
        </div>
      </div>
    </article>
  )
}
