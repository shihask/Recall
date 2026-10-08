import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FieldError, Input, Label, Textarea } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/services/supabase/errors'
import type { CollectionRow } from '@/types/database'
import { useCreateCollection, useUpdateCollection } from './hooks'

const ICONS = ['🏍️', '✈️', '🍳', '💻', '🏠', '📸', '💡', '🛒', '📚', '🎨', '🏋️', '🌱', '🎬', '🧰', '💰', '❤️']

interface CollectionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this collection; omit to create. */
  collection?: CollectionRow
  onCreated?: (c: CollectionRow) => void
}

export function CollectionFormDialog({ open, onOpenChange, collection, onCreated }: CollectionFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={collection ? 'Edit collection' : 'New collection'}>
      {open && <CollectionForm key={collection?.id ?? 'new'} collection={collection} onDone={() => onOpenChange(false)} onCreated={onCreated} />}
    </Dialog>
  )
}

function CollectionForm({ collection, onDone, onCreated }: { collection?: CollectionRow; onDone: () => void; onCreated?: (c: CollectionRow) => void }) {
  const [name, setName] = useState(collection?.name ?? '')
  const [icon, setIcon] = useState<string | null>(collection?.icon ?? null)
  const [description, setDescription] = useState(collection?.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const create = useCreateCollection()
  const update = useUpdateCollection()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const input = { name, icon, description }
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
          placeholder="Bike Ideas"
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!error}
          aria-describedby="collection-error"
        />
        <FieldError id="collection-error">{error}</FieldError>
      </div>
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
