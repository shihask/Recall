import { displayHost } from '@shared/url.ts'
import { AlertCircle, ArrowLeft, ExternalLink, Heart, Loader2, SearchX, Share2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SourceIcon } from '@/components/SourceIcon'
import { Thumbnail } from '@/components/Thumbnail'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, ErrorNotice, FullPageSpinner } from '@/components/ui/misc'
import { CollectionPicker } from '@/features/collections/CollectionPicker'
import { useToggleItemCollection } from '@/features/collections/hooks'
import { itemTitle, SUMMARY_UNAVAILABLE } from '@/features/saves/display'
import { EditItemDialog } from '@/features/saves/EditItemDialog'
import { isProcessing, useItem, useToggleFavorite } from '@/features/saves/hooks'
import { ItemMenu } from '@/features/saves/ItemMenu'
import { NoteEditor } from '@/features/saves/NoteEditor'
import { needsNote, previewlessTitle } from '@/features/saves/useSaveNote'
import { shareItem } from '@/features/saves/share'
import { ItemTagsEditor } from '@/features/tags/ItemTagsEditor'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/cn'
import { describeSource, openOriginalLabel } from '@/services/metadata/sourceLabels'
import { errorMessage } from '@/services/supabase/errors'
import type { SavedItem } from '@/types/domain'
import { longDate, savedAgo } from '@/utils/dates'
import { safeHttpUrl } from '@/utils/safeUrl'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-6">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-subtle uppercase">{title}</h2>
      {children}
    </section>
  )
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: item, isPending, isError, error, refetch } = useItem(id)

  useEffect(() => {
    if (item?.id) track('item_opened')
  }, [item?.id])

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/saves'))

  if (isPending) return <FullPageSpinner />
  if (isError) return <ErrorNotice message={errorMessage(error)} onRetry={() => void refetch()} />
  if (!item) {
    return (
      <EmptyState
        icon={SearchX}
        title="This memory doesn’t exist."
        description="It may have been deleted."
        action={
          <Link to="/saves" className="text-sm font-medium hover:underline">
            Back to All Saves
          </Link>
        }
      />
    )
  }
  return <ItemDetail item={item} onBack={back} />
}

function ItemDetail({ item, onBack }: { item: SavedItem; onBack: () => void }) {
  const [editing, setEditing] = useState(false)
  const toggleFavorite = useToggleFavorite()
  const toggleCollection = useToggleItemCollection()
  const original = safeHttpUrl(item.url)
  const authorUrl = safeHttpUrl(item.author_url)
  const processing = isProcessing(item)
  const summary = item.ai_summary && item.ai_summary !== SUMMARY_UNAVAILABLE ? item.ai_summary : null
  const noPreview = !processing && !item.title && !item.thumbnail_url

  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        <ItemMenu item={item} onEdit={() => setEditing(true)} afterDelete="/saves" />
      </div>

      {(item.thumbnail_url || processing) && (
        <Thumbnail
          src={item.thumbnail_url}
          source={item.source}
          type={item.source_type}
          className="mb-6 aspect-video max-h-[420px] w-full rounded-2xl border border-line"
          iconClassName="h-10 w-10"
        />
      )}

      <header>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <SourceIcon source={item.source} type={item.source_type} />
          {item.source === 'website' ? displayHost(item.url) : describeSource(item.source, item.source_type)}
          {item.ai_category && (
            <Badge className="ml-1.5" tone="accent">
              {item.ai_category}
            </Badge>
          )}
          {item.is_archived && <Badge className="ml-1">Archived</Badge>}
        </p>
        <h1 className="mt-2 text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">{itemTitle(item)}</h1>
        {item.author_name && (
          <p className="mt-2 text-sm text-muted">
            {authorUrl ? (
              <a href={authorUrl} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-fg hover:underline">
                {item.author_name}
              </a>
            ) : (
              item.author_name
            )}
          </p>
        )}
      </header>

      {processing && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm text-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Processing content… you can keep organizing meanwhile.
        </p>
      )}
      {noPreview && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm text-muted">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {needsNote(item)
              ? `${previewlessTitle(item.source)} Add a note below about what it was — Recall will use it to tag and find it.`
              : 'Metadata unavailable. We saved the link, but couldn’t retrieve its preview. You can still organize and find it.'}
          </span>
        </p>
      )}

      <div className="sticky bottom-20 z-20 mt-6 flex gap-2 lg:static">
        {original && (
          <a
            href={original}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-medium text-accent-fg shadow-lift transition-colors hover:bg-accent-hover sm:flex-none lg:shadow-sm"
          >
            {openOriginalLabel(item.source)} <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
        <Button
          variant="outline"
          size="icon"
          className={cn('h-12 w-12', item.is_favorite && 'text-danger')}
          onClick={() => toggleFavorite(item)}
          aria-pressed={item.is_favorite}
          aria-label={item.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={cn('h-5 w-5', item.is_favorite && 'fill-current')} />
        </Button>
        <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => void shareItem(item)} aria-label="Share link">
          <Share2 className="h-5 w-5" />
        </Button>
      </div>

      <div className="mt-8">
        <Section title="AI Summary">
          {summary ? (
            <p className="leading-relaxed">{summary}</p>
          ) : (
            <p className="text-muted">{processing ? 'Summarizing…' : SUMMARY_UNAVAILABLE}</p>
          )}
          {item.description && item.description !== summary && (
            <p className="mt-3 line-clamp-6 text-sm leading-relaxed text-muted">{item.description}</p>
          )}
        </Section>

        <Section title="My Note">
          <NoteEditor
            key={item.id}
            item={item}
            startEditing={needsNote(item)}
            placeholder={needsNote(item) ? 'e.g. 3D printed phone mount for my bike' : undefined}
          />
        </Section>

        <Section title="Tags">
          <ItemTagsEditor item={item} />
        </Section>

        <Section title="Collections">
          <CollectionPicker
            selected={item.collections.map((c) => c.id)}
            onToggle={(collectionId, add) => toggleCollection.mutate({ itemId: item.id, collectionId, add })}
          />
        </Section>

        <Section title="Saved">
          <p>{longDate(item.saved_at)}</p>
          <p className="mt-0.5 text-sm text-subtle">{savedAgo(item.saved_at)}</p>
          {original && <p className="mt-3 truncate text-xs text-subtle">{original}</p>}
        </Section>
      </div>

      <EditItemDialog item={item} open={editing} onOpenChange={setEditing} />
    </article>
  )
}
