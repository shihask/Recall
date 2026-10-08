import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FieldError, Input, Label } from '@/components/ui/Input'
import { errorMessage } from '@/services/supabase/errors'
import type { TagRow } from '@/types/database'
import { useRenameTag } from './hooks'

export function RenameTagDialog({ tag, open, onOpenChange }: { tag: Pick<TagRow, 'id' | 'name'>; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Rename tag">
      {open && <RenameForm key={tag.id} tag={tag} onDone={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function RenameForm({ tag, onDone }: { tag: Pick<TagRow, 'id' | 'name'>; onDone: () => void }) {
  const [name, setName] = useState(tag.name)
  const [error, setError] = useState<string | null>(null)
  const rename = useRenameTag()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await rename.mutateAsync({ id: tag.id, name })
      onDone()
    } catch (err) {
      const message = errorMessage(err)
      setError(message === 'That already exists.' ? 'You already have a tag with that name.' : message)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="tag-name">Name</Label>
        <Input id="tag-name" autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-invalid={!!error} />
        <FieldError id="tag-error">{error}</FieldError>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={rename.isPending} disabled={!name.trim()}>
          Rename
        </Button>
      </div>
    </form>
  )
}
