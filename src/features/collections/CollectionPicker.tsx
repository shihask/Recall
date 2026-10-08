import { Check, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/services/supabase/errors'
import { useCollections, useCreateCollection } from './hooks'
import { buildCollectionTree } from './tree'

interface CollectionPickerProps {
  selected: string[]
  onToggle: (collectionId: string, selected: boolean) => void
}

/** Multi-select chips (sub-collections follow their parent) with inline "New collection". */
export function CollectionPicker({ selected, onToggle }: CollectionPickerProps) {
  const { data: collections, isLoading } = useCollections()
  const create = useCreateCollection()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  async function onCreate(e?: FormEvent) {
    e?.preventDefault()
    if (!name.trim()) return
    try {
      const c = await create.mutateAsync({ name })
      onToggle(c.id, true)
      setName('')
      setCreating(false)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  if (isLoading) return <div className="h-9 animate-pulse rounded-xl bg-surface-2" />

  return (
    <div className="flex flex-wrap gap-2">
      {buildCollectionTree(collections ?? []).flatMap((parent) => [parent, ...parent.children]).map((c) => {
        const isOn = selected.includes(c.id)
        const isSub = !!c.parent_id
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggle(c.id, !isOn)}
            aria-pressed={isOn}
            aria-label={isSub ? `${c.name} (in ${collections?.find((p) => p.id === c.parent_id)?.name ?? 'a collection'})` : undefined}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm transition-colors',
              isOn ? 'border-accent bg-accent-soft text-accent-soft-fg' : 'border-line bg-surface text-fg hover:bg-surface-2',
            )}
          >
            {isSub && (
              <span className="text-subtle" aria-hidden>
                ›
              </span>
            )}
            {isOn ? <Check className="h-3.5 w-3.5" aria-hidden /> : c.icon && <span aria-hidden>{c.icon}</span>}
            {c.name}
          </button>
        )
      })}
      {creating ? (
        // Not a <form>: this can render inside the Save form, and forms can't nest.
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void onCreate()
              } else if (e.key === 'Escape') {
                e.stopPropagation()
                setCreating(false)
              }
            }}
            placeholder="Collection name"
            aria-label="New collection name"
            className="h-9 w-44 rounded-xl border border-accent bg-surface px-3 text-sm focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void onCreate()}
            disabled={!name.trim() || create.isPending}
            className="h-9 rounded-xl bg-accent px-3 text-sm font-medium text-accent-fg disabled:opacity-50"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-dashed border-line-strong px-3 text-sm text-muted hover:text-fg"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New collection
        </button>
      )}
    </div>
  )
}
