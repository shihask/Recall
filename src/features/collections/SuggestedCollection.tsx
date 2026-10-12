import { FolderPlus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import type { SavedItem } from '@/types/domain'
import { useCollections, useCreateSuggestedCollection } from './hooks'
import { dismissSuggestion, suggestedCollection } from './suggestion'

/** "Start a Video Editing collection?" — shown when none of the user's collections fit a save. */
export function SuggestedCollection({ item, className }: { item: SavedItem; className?: string }) {
  const [dismissed, setDismissed] = useState(false)
  const { data: collections } = useCollections()
  const create = useCreateSuggestedCollection()
  const name = dismissed ? null : suggestedCollection(item)
  if (!name) return null

  // Made from another save in the meantime: offer to add instead.
  const exists = collections?.some((c) => c.name.trim().toLowerCase() === name.toLowerCase())

  return (
    <div className={cn('flex animate-fade-in items-start gap-3 rounded-2xl bg-accent-soft p-3.5 text-accent-soft-fg', className)}>
      <FolderPlus className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{exists ? `Add to ${name}?` : `Start a “${name}” collection?`}</p>
        <p className="mt-0.5 text-sm opacity-80">
          {exists ? 'It looks like it belongs there.' : 'None of your collections fit this save.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" loading={create.isPending} onClick={() => create.mutate({ itemId: item.id, name })}>
            {exists ? `Add to ${name}` : 'Create & add'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-accent-soft-fg"
            disabled={create.isPending}
            onClick={() => {
              dismissSuggestion(item.id)
              setDismissed(true)
            }}
          >
            Not now
          </Button>
        </div>
      </div>
    </div>
  )
}
