import { FolderOpen, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorNotice, PageHeader, Skeleton } from '@/components/ui/misc'
import { CollectionFormDialog } from '@/features/collections/CollectionFormDialog'
import { useCollections } from '@/features/collections/hooks'
import { errorMessage } from '@/services/supabase/errors'

export default function CollectionsPage() {
  const { data, isPending, isError, error, refetch } = useCollections()
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <PageHeader
        title="Collections"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New collection
          </Button>
        }
      />
      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorNotice message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No collections yet."
          description="Organize your saves into collections when you’re ready."
          action={<Button onClick={() => setCreating(true)}>Create a collection</Button>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <li key={c.id}>
              <Link
                to={`/collections/${c.id}`}
                className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-shadow hover:shadow-soft"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-xl" aria-hidden>
                  {c.icon ?? <FolderOpen className="h-5 w-5 text-subtle" />}
                </span>
                <span className="mt-4 font-semibold tracking-tight">{c.name}</span>
                {c.description && <span className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</span>}
                <span className="mt-auto pt-3 text-xs text-subtle">
                  {c.item_count} {c.item_count === 1 ? 'save' : 'saves'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CollectionFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
