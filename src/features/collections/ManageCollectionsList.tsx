import { FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/misc'
import type { CollectionRow } from '@/types/database'
import { CollectionFormDialog } from './CollectionFormDialog'
import { useCollections, useDeleteCollection } from './hooks'
import { buildCollectionTree, childrenOf, deleteCollectionDescription } from './tree'

/**
 * The user's collections with rename/edit and delete, for onboarding. Unlike
 * CollectionMenu it needs no save sheet, so it works outside the app shell.
 */
export function ManageCollectionsList() {
  const { data: collections = [], isPending } = useCollections()
  const [editing, setEditing] = useState<CollectionRow | null>(null)
  const [deleting, setDeleting] = useState<CollectionRow | null>(null)
  const [creating, setCreating] = useState(false)
  const del = useDeleteCollection()

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    )
  }

  const rows = buildCollectionTree(collections).flatMap((c) => [c, ...c.children])

  return (
    <div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">No collections yet. You can add them anytime.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {rows.map((c) => (
            <li key={c.id} className={c.parent_id ? 'flex items-center gap-3 py-2 pr-2 pl-10' : 'flex items-center gap-3 p-2 pl-3'}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-lg" aria-hidden>
                {c.icon ?? <FolderOpen className="h-4 w-4 text-subtle" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`} className="hover:text-danger" onClick={() => setDeleting(c)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreating(true)}>
        <Plus className="h-4 w-4" aria-hidden /> New collection
      </Button>

      <CollectionFormDialog open={creating} onOpenChange={setCreating} />
      <CollectionFormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} collection={editing ?? undefined} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        description={deleteCollectionDescription(deleting ? childrenOf(collections, deleting.id) : [])}
        confirmLabel="Delete collection"
        destructive
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  )
}
