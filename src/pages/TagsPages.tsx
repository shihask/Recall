import { Pencil, Tag as TagIcon, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { EmptyState, ErrorNotice, FullPageSpinner, PageHeader, Skeleton } from '@/components/ui/misc'
import { LibraryView } from '@/features/saves/LibraryView'
import { useDeleteTag, useTag, useTags } from '@/features/tags/hooks'
import { RenameTagDialog } from '@/features/tags/RenameTagDialog'
import { errorMessage } from '@/services/supabase/errors'

export function TagsPage() {
  const { data, isPending, isError, error, refetch } = useTags()
  const [filter, setFilter] = useState('')
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (data ?? []).filter((t) => !q || t.name.toLowerCase().includes(q))
  }, [data, filter])

  return (
    <div>
      <PageHeader title="Tags" description="Added by you, or suggested when Recall processes a save." />
      {isPending ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorNotice message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState icon={TagIcon} title="No tags yet." description="Tags appear as you save and organize things." />
      ) : (
        <>
          {data.length > 12 && (
            <Input className="mb-5 max-w-xs" placeholder="Filter tags…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter tags" />
          )}
          <ul className="flex flex-wrap gap-2">
            {shown.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/tags/${t.id}`}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm transition-colors hover:border-line-strong"
                >
                  {t.name}
                  <span className="text-xs text-subtle">{t.item_count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function TagDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: tag, isPending } = useTag(id)
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const del = useDeleteTag()
  const navigate = useNavigate()

  if (isPending) return <FullPageSpinner />
  if (!tag) {
    return (
      <EmptyState
        icon={TagIcon}
        title="Tag not found."
        action={
          <Link to="/tags" className="text-sm font-medium hover:underline">
            All tags
          </Link>
        }
      />
    )
  }

  return (
    <>
      <LibraryView
        key={tag.id}
        params={{ view: 'all', tagId: tag.id }}
        title={`# ${tag.name}`}
        headerActions={
          <>
            <Button variant="outline" size="icon" onClick={() => setRenaming(true)} aria-label="Rename tag">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setConfirming(true)} aria-label="Delete tag">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
        empty={{ icon: TagIcon, title: 'Nothing tagged with this yet.', description: 'Add this tag from any save.' }}
      />
      <RenameTagDialog tag={tag} open={renaming} onOpenChange={setRenaming} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete tag “${tag.name}”?`}
        description="It’s removed from every save. The saves themselves stay."
        confirmLabel="Delete tag"
        destructive
        loading={del.isPending}
        onConfirm={() => del.mutate(tag.id, { onSuccess: () => navigate('/tags', { replace: true }) })}
      />
    </>
  )
}
