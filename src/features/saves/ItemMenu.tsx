import * as Menu from '@radix-ui/react-dropdown-menu'
import { Archive, ArchiveRestore, ExternalLink, FolderPlus, MoreHorizontal, Pencil, RefreshCw, Share2, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { CollectionPicker } from '@/features/collections/CollectionPicker'
import { useToggleItemCollection } from '@/features/collections/hooks'
import { cn } from '@/lib/cn'
import type { SavedItem } from '@/types/domain'
import { safeHttpUrl } from '@/utils/safeUrl'
import { useArchiveItem, useDeleteItem, useReprocessItem } from './hooks'
import { shareItem } from './share'

function Item({ icon, children, onSelect, destructive }: { icon: ReactNode; children: ReactNode; onSelect: () => void; destructive?: boolean }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-surface-2',
        destructive && 'text-danger',
      )}
    >
      {icon}
      {children}
    </Menu.Item>
  )
}

interface ItemMenuProps {
  item: SavedItem
  onEdit?: () => void
  /** Navigate here after a permanent delete (detail page). */
  afterDelete?: string
  triggerClassName?: string
}

export function ItemMenu({ item, onEdit, afterDelete, triggerClassName }: ItemMenuProps) {
  const archive = useArchiveItem()
  const del = useDeleteItem()
  const reprocess = useReprocessItem()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pickCollections, setPickCollections] = useState(false)
  const toggleCollection = useToggleItemCollection()
  const original = safeHttpUrl(item.url)

  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger
          aria-label="More actions"
          className={cn('relative z-10 rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg data-[state=open]:bg-surface-2', triggerClassName)}
        >
          <MoreHorizontal className="h-5 w-5" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-48 rounded-xl border border-line bg-surface p-1 shadow-lift data-[state=open]:animate-fade-in"
          >
            {original && (
              <Item icon={<ExternalLink className="h-4 w-4" />} onSelect={() => window.open(original, '_blank', 'noopener,noreferrer')}>
                Open original
              </Item>
            )}
            <Item icon={<Share2 className="h-4 w-4" />} onSelect={() => void shareItem(item)}>
              Share link
            </Item>
            <Item icon={<FolderPlus className="h-4 w-4" />} onSelect={() => setPickCollections(true)}>
              Add to collection…
            </Item>
            {onEdit && (
              <Item icon={<Pencil className="h-4 w-4" />} onSelect={onEdit}>
                Edit
              </Item>
            )}
            <Item icon={<RefreshCw className="h-4 w-4" />} onSelect={() => reprocess.mutate(item.id)}>
              Refresh details
            </Item>
            <Menu.Separator className="my-1 h-px bg-line" />
            {item.is_archived ? (
              <Item icon={<ArchiveRestore className="h-4 w-4" />} onSelect={() => archive.mutate({ id: item.id, archived: false })}>
                Restore
              </Item>
            ) : (
              <Item icon={<Archive className="h-4 w-4" />} onSelect={() => archive.mutate({ id: item.id, archived: true })}>
                Archive
              </Item>
            )}
            <Item destructive icon={<Trash2 className="h-4 w-4" />} onSelect={() => setConfirmDelete(true)}>
              {item.is_archived ? 'Delete permanently' : 'Delete'}
            </Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>

      <Dialog open={pickCollections} onOpenChange={setPickCollections} title="Collections" description="A save can live in as many collections as you like.">
        <CollectionPicker
          selected={item.collections.map((c) => c.id)}
          onToggle={(collectionId, add) => toggleCollection.mutate({ itemId: item.id, collectionId, add })}
        />
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this memory?"
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(item.id, {
            onSuccess: () => {
              setConfirmDelete(false)
              if (afterDelete) navigate(afterDelete, { replace: true })
            },
          })
        }
      />
    </>
  )
}
