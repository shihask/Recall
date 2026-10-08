import { CATEGORIES, type Category } from '@shared/categories.ts'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Label, Textarea } from '@/components/ui/Input'
import type { SavedItem } from '@/types/domain'
import { useUpdateItem } from './hooks'

interface EditItemDialogProps {
  item: SavedItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditItemDialog({ item, open, onOpenChange }: EditItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Edit save">
      {/* Keyed so each open starts from the item's current values. */}
      {open && <EditForm key={item.updated_at} item={item} onDone={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function EditForm({ item, onDone }: { item: SavedItem; onDone: () => void }) {
  const update = useUpdateItem()
  const [title, setTitle] = useState(item.title ?? '')
  const [description, setDescription] = useState(item.description ?? '')
  const [category, setCategory] = useState<Category | ''>(item.ai_category ?? '')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const edited = new Set(item.user_edited)
    const patch: Parameters<typeof update.mutate>[0]['patch'] = {}
    const nextTitle = title.trim() || null
    const nextDescription = description.trim() || null
    const nextCategory = category || null
    // Record hand-edited fields so background enrichment never overwrites them.
    if (nextTitle !== item.title) {
      patch.title = nextTitle
      edited.add('title')
    }
    if (nextDescription !== item.description) {
      patch.description = nextDescription
      edited.add('description')
    }
    if (nextCategory !== item.ai_category) {
      patch.ai_category = nextCategory
      edited.add('ai_category')
    }
    if (Object.keys(patch).length === 0) return onDone()
    patch.user_edited = [...edited]
    update.mutate({ id: item.id, patch }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="edit-title">Title</Label>
        <Input id="edit-title" value={title} maxLength={500} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="edit-description">Description</Label>
        <Textarea id="edit-description" rows={3} value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="edit-category">Category</Label>
        <select
          id="edit-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | '')}
          className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] focus:border-accent focus:ring-4 focus:ring-[var(--ring)] focus:outline-none"
        >
          <option value="">No category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={update.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  )
}
