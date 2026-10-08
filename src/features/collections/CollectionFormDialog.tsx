import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FieldError, Input, Label, Textarea } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/services/supabase/errors'
import type { CollectionRow } from '@/types/database'
import { useCollections, useCreateCollection, useUpdateCollection } from './hooks'
import { canHaveParent, parentOptions } from './tree'

const ICONS = ['🏍️', '✈️', '🍳', '💻', '🏠', '📸', '💡', '🛒', '📚', '🎨', '🏋️', '🌱', '🎬', '🧰', '💰', '❤️']

interface CollectionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this collection; omit to create. */
  collection?: CollectionRow
  /** When creating: start inside this collection (a new sub-collection). */
  defaultParentId?: string
  onCreated?: (c: CollectionRow) => void
}

export function CollectionFormDialog({ open, onOpenChange, collection, defaultParentId, onCreated }: CollectionFormDialogProps) {
  const title = collection ? 'Edit collection' : defaultParentId ? 'New sub-collection' : 'New collection'
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      {open && (
        <CollectionForm
          key={collection?.id ?? 'new'}
          collection={collection}
          defaultParentId={defaultParentId}
          onDone={() => onOpenChange(false)}
          onCreated={onCreated}
        />
      )}
    </Dialog>
  )
}

interface CollectionFormProps {
  collection?: CollectionRow
  defaultParentId?: string
  onDone: () => void
  onCreated?: (c: CollectionRow) => void
}

function CollectionForm({ collection, defaultParentId, onDone, onCreated }: CollectionFormProps) {
  const [name, setName] = useState(collection?.name ?? '')
  const [icon, setIcon] = useState<string | null>(collection?.icon ?? null)
  const [description, setDescription] = useState(collection?.description ?? '')
  const [parentId, setParentId] = useState(collection ? (collection.parent_id ?? '') : (defaultParentId ?? ''))
  const [error, setError] = useState<string | null>(null)
  const { data: collections = [] } = useCollections()
  const create = useCreateCollection()
  const update = useUpdateCollection()

  const parents = parentOptions(collections, collection)
  // One level only: a collection that has sub-collections stays top-level.
  const hasChildren = !!collection && !canHaveParent(collection, collections)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const input = { name, icon, description, parentId: parentId || null }
      if (collection) await update.mutateAsync({ id: collection.id, input })
      else onCreated?.(await create.mutateAsync(input))
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <Label htmlFor="collection-name">Name</Label>
        <Input
          id="collection-name"
          autoFocus
          value={name}
          maxLength={60}
          placeholder={parentId ? 'Munnar' : 'Bike Ideas'}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!error}
          aria-describedby="collection-error"
        />
        <FieldError id="collection-error">{error}</FieldError>
      </div>
      {(parents.length > 0 || !!parentId) && (
        <div>
          <Label htmlFor="collection-parent" hint="Optional">
            Inside
          </Label>
          <select
            id="collection-parent"
            value={parentId}
            disabled={hasChildren}
            onChange={(e) => setParentId(e.target.value)}
            aria-describedby={hasChildren ? 'collection-parent-hint' : undefined}
            className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-fg transition-colors focus:border-accent focus:ring-4 focus:ring-[var(--ring)] focus:outline-none disabled:opacity-60"
          >
            <option value="">None (top level)</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon ? `${p.icon} ` : ''}
                {p.name}
              </option>
            ))}
          </select>
          {hasChildren && (
            <p id="collection-parent-hint" className="mt-1.5 text-xs text-subtle">
              This collection has its own sub-collections, so it stays at the top level.
            </p>
          )}
        </div>
      )}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Icon</legend>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setIcon(null)}
            aria-pressed={icon === null}
            className={cn('h-10 w-10 rounded-xl border text-xs text-subtle', icon === null ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2')}
          >
            None
          </button>
          {ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              aria-pressed={icon === i}
              aria-label={`Icon ${i}`}
              className={cn('h-10 w-10 rounded-xl border text-lg', icon === i ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2')}
            >
              {i}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <Label htmlFor="collection-description" hint="Optional">
          Description
        </Label>
        <Textarea id="collection-description" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={create.isPending || update.isPending} disabled={!name.trim()}>
          {collection ? 'Save changes' : 'Create collection'}
        </Button>
      </div>
    </form>
  )
}
