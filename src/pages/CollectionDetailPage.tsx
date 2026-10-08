import { ChevronLeft, FolderOpen, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, FullPageSpinner } from '@/components/ui/misc'
import { CollectionFormDialog } from '@/features/collections/CollectionFormDialog'
import { useCollection, useCollections, useDeleteCollection } from '@/features/collections/hooks'
import { childrenOf } from '@/features/collections/tree'
import { LibraryView } from '@/features/saves/LibraryView'
import { useSaveSheet } from '@/features/saves/save-sheet-context'
import type { CollectionWithCount } from '@/types/domain'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function listNames(names: string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export default function CollectionDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: collection, isPending } = useCollection(id)
  // Needed before listing items: a parent's list includes its sub-collections.
  const { data: collections, isPending: collectionsPending } = useCollections()
  const [editing, setEditing] = useState(false)
  const [creatingSub, setCreatingSub] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const del = useDeleteCollection()
  const navigate = useNavigate()
  const { openSave } = useSaveSheet()

  if (isPending || collectionsPending) return <FullPageSpinner />
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

  const all = collections ?? []
  const parent = collection.parent_id ? all.find((c) => c.id === collection.parent_id) : undefined
  const isSub = !!collection.parent_id
  const children = isSub ? [] : childrenOf(all, collection.id)
  const total = all.find((c) => c.id === collection.id)?.total_count
  const description = [total !== undefined && plural(total, 'save', 'saves'), collection.description].filter(Boolean).join(' · ')

  const empty = isSub
    ? { title: 'This collection is empty.', description: 'Add saves from any item, or save something new straight into it.' }
    : children.length > 0
      ? { title: `No saves in ${collection.name} yet.`, description: `Save into ${collection.name} or one of its sub-collections.` }
      : { title: 'No saved items yet.', description: 'Save something here, or create a sub-collection to organize your saves.' }

  return (
    <>
      <LibraryView
        key={collection.id}
        params={{ view: 'all', collectionId: collection.id, subCollectionIds: children.map((c) => c.id) }}
        title={`${collection.icon ? `${collection.icon} ` : ''}${collection.name}`}
        description={description || undefined}
        saveCollectionId={collection.id}
        eyebrow={
          isSub && (
            <Link
              to={`/collections/${collection.parent_id}`}
              className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              {parent ? `${parent.icon ? `${parent.icon} ` : ''}${parent.name}` : 'Collections'}
            </Link>
          )
        }
        intro={!isSub && <SubCollections items={children} onCreate={() => setCreatingSub(true)} />}
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
        empty={{ icon: FolderOpen, ...empty, showSave: true }}
      />
      <CollectionFormDialog open={editing} onOpenChange={setEditing} collection={collection} />
      <CollectionFormDialog open={creatingSub} onOpenChange={setCreatingSub} defaultParentId={collection.id} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete “${collection.name}”?`}
        description={
          children.length > 0
            ? `${listNames(children.map((c) => c.name))} ${children.length === 1 ? 'moves' : 'move'} to the top level. Saves stay in your library.`
            : 'The collection is removed. The saves inside it stay in your library.'
        }
        confirmLabel="Delete collection"
        destructive
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(collection.id, { onSuccess: () => navigate(parent ? `/collections/${parent.id}` : '/collections', { replace: true }) })
        }
      />
    </>
  )
}

function SubCollections({ items, onCreate }: { items: CollectionWithCount[]; onCreate: () => void }) {
  return (
    <ul className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
      {items.map((c) => (
        <li key={c.id} className="shrink-0">
          <Link
            to={`/collections/${c.id}`}
            className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm transition-colors hover:bg-surface-2"
          >
            {c.icon ? <span aria-hidden>{c.icon}</span> : <FolderOpen className="h-4 w-4 text-subtle" aria-hidden />}
            <span className="font-medium">{c.name}</span>
            <span className="text-xs text-subtle" aria-label={plural(c.item_count, 'save', 'saves')}>
              {c.item_count}
            </span>
          </Link>
        </li>
      ))}
      <li className="shrink-0">
        <button
          type="button"
          onClick={onCreate}
          className="flex h-11 items-center gap-2 rounded-xl border border-dashed border-line-strong px-3.5 text-sm text-muted hover:text-fg"
        >
          <FolderPlus className="h-4 w-4" aria-hidden />
          New sub-collection
        </button>
      </li>
    </ul>
  )
}
