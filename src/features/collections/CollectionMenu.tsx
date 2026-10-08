import * as Menu from '@radix-ui/react-dropdown-menu'
import { FolderPlus, Link2, ListPlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useSaveSheet } from '@/features/saves/save-sheet-context'
import { cn } from '@/lib/cn'
import type { CollectionRow } from '@/types/database'
import { AddSavesDialog } from './AddSavesDialog'
import { CollectionFormDialog } from './CollectionFormDialog'
import { useDeleteCollection } from './hooks'
import { childrenOf, deleteCollectionDescription } from './tree'

const itemClass = 'flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-surface-2'

function Item({ icon, children, onSelect, destructive }: { icon: ReactNode; children: ReactNode; onSelect: () => void; destructive?: boolean }) {
  return (
    <Menu.Item onSelect={onSelect} className={cn(itemClass, destructive && 'text-danger')}>
      {icon}
      {children}
    </Menu.Item>
  )
}

interface CollectionMenuProps {
  collection: CollectionRow
  /** All of the user's collections (to find sub-collections). */
  collections: CollectionRow[]
  triggerClassName?: string
  onDeleted?: () => void
}

/** "⋯" actions for a collection tile or sub-collection chip. */
export function CollectionMenu({ collection, collections, triggerClassName, onDeleted }: CollectionMenuProps) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [creatingSub, setCreatingSub] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { openSave } = useSaveSheet()
  const del = useDeleteCollection()
  const isSub = !!collection.parent_id

  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger
          aria-label={`Actions for ${collection.name}`}
          className={cn('rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg data-[state=open]:bg-surface-2', triggerClassName)}
        >
          <MoreHorizontal className="h-5 w-5" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content align="end" sideOffset={4} className="z-50 min-w-52 rounded-xl border border-line bg-surface p-1 shadow-lift data-[state=open]:animate-fade-in">
            <Item icon={<ListPlus className="h-4 w-4" />} onSelect={() => setAdding(true)}>
              Add from your saves
            </Item>
            <Item icon={<Link2 className="h-4 w-4" />} onSelect={() => openSave({ collectionId: collection.id })}>
              Save a new link
            </Item>
            {!isSub && (
              <Item icon={<FolderPlus className="h-4 w-4" />} onSelect={() => setCreatingSub(true)}>
                New sub-collection
              </Item>
            )}
            <Item icon={<Pencil className="h-4 w-4" />} onSelect={() => setEditing(true)}>
              Edit
            </Item>
            <Menu.Separator className="my-1 h-px bg-line" />
            <Item destructive icon={<Trash2 className="h-4 w-4" />} onSelect={() => setConfirming(true)}>
              Delete
            </Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>

      <AddSavesDialog open={adding} onOpenChange={setAdding} collection={collection} />
      <CollectionFormDialog open={editing} onOpenChange={setEditing} collection={collection} />
      <CollectionFormDialog open={creatingSub} onOpenChange={setCreatingSub} defaultParentId={collection.id} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete “${collection.name}”?`}
        description={deleteCollectionDescription(childrenOf(collections, collection.id))}
        confirmLabel="Delete collection"
        destructive
        loading={del.isPending}
        onConfirm={() => del.mutate(collection.id, { onSuccess: () => (setConfirming(false), onDeleted?.()) })}
      />
    </>
  )
}
