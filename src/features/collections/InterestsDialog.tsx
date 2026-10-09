import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useCollections, useCreateInterestCollections } from './hooks'
import { InterestPicker } from './InterestPicker'
import { existingInterestIds, interestsToCreate } from './interests'

/** "Suggestions" on the Collections page: the onboarding interest picker, for existing users. */
export function InterestsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add collections from interests"
      description="Pick what you save. Recall creates a collection for each and files matching saves into them."
    >
      {open && <InterestsForm onDone={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function InterestsForm({ onDone }: { onDone: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { data: collections = [] } = useCollections()
  const create = useCreateInterestCollections()
  const existing = existingInterestIds(collections.map((c) => c.name))
  const toCreate = interestsToCreate(selected, collections.map((c) => c.name))

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="space-y-5">
      <div className="max-h-[50dvh] overflow-y-auto">
        <InterestPicker selected={selected} onToggle={toggle} existing={existing} />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={toCreate.length === 0}
          loading={create.isPending}
          onClick={() =>
            create.mutate(toCreate, {
              onSuccess: (n) => {
                toast.success(n === 1 ? 'Added 1 collection.' : `Added ${n} collections.`)
                onDone()
              },
            })
          }
        >
          {toCreate.length > 1 ? `Add ${toCreate.length} collections` : 'Add collection'}
        </Button>
      </div>
    </div>
  )
}
