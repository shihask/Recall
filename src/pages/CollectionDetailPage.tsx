import { FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, FullPageSpinner } from '@/components/ui/misc'
import { CollectionFormDialog } from '@/features/collections/CollectionFormDialog'
import { useCollection, useDeleteCollection } from '@/features/collections/hooks'
import { LibraryView } from '@/features/saves/LibraryView'
import { useSaveSheet } from '@/features/saves/save-sheet-context'

export default function CollectionDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: collection, isPending } = useCollection(id)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const del = useDeleteCollection()
  const navigate = useNavigate()
  const { openSave } = useSaveSheet()

  if (isPending) return <FullPageSpinner />
  if (!collection) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Collection not found."
        action={
          <Link to="/collections" className="text-sm font-medium hover:underline">
            All collections
          </Link>
        }
      />
    )
  }

  return (
    <>
      <LibraryView
        key={collection.id}
        params={{ view: 'all', collectionId: collection.id }}
        title={`${collection.icon ? `${collection.icon} ` : ''}${collection.name}`}
        description={collection.description ?? undefined}
        saveCollectionId={collection.id}
        headerActions={
          <>
            <Button variant="outline" size="icon" onClick={() => openSave({ collectionId: collection.id })} aria-label="Save to this collection">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setEditing(true)} aria-label="Edit collection">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setConfirming(true)} aria-label="Delete collection">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
        empty={{ icon: FolderOpen, title: 'This collection is empty.', description: 'Add saves from any item, or save something new straight into it.', showSave: true }}
      />
      <CollectionFormDialog open={editing} onOpenChange={setEditing} collection={collection} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete “${collection.name}”?`}
        description="The collection is removed. The saves inside it stay in your library."
        confirmLabel="Delete collection"
        destructive
        loading={del.isPending}
        onConfirm={() => del.mutate(collection.id, { onSuccess: () => navigate('/collections', { replace: true }) })}
      />
    </>
  )
}
