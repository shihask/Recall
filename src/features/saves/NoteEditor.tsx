import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { requestProcessing } from '@/services/supabase/items'
import type { SavedItem } from '@/types/domain'
import { useUpdateItem } from './hooks'

/** "My Note" — the user's own words are the strongest retrieval signal. */
export function NoteEditor({ item }: { item: SavedItem }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.personal_note ?? '')
  const update = useUpdateItem()

  function save() {
    const next = draft.trim() || null
    if (next === item.personal_note) return setEditing(false)
    update.mutate(
      { id: item.id, patch: { personal_note: next } },
      {
        onSuccess: () => {
          setEditing(false)
          // Notes feed semantic search; refresh the embedding in the background.
          void requestProcessing(item.id, { jobType: 'embed' })
        },
      },
    )
  }

  if (!editing) {
    return item.personal_note ? (
      <button type="button" onClick={() => { setDraft(item.personal_note ?? ''); setEditing(true) }} className="group w-full text-left">
        <p className="leading-relaxed whitespace-pre-wrap">{item.personal_note}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs text-subtle group-hover:text-fg">
          <Pencil className="h-3 w-3" aria-hidden /> Edit note
        </span>
      </button>
    ) : (
      <button type="button" onClick={() => { setDraft(''); setEditing(true) }} className="text-sm text-muted hover:text-fg">
        + Add a note — why did you save this?
      </button>
    )
  }

  return (
    <div>
      <Textarea
        autoFocus
        aria-label="Your note"
        rows={4}
        value={draft}
        maxLength={5000}
        placeholder="Why am I saving this?"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
          if (e.key === 'Escape') setEditing(false)
        }}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} loading={update.isPending}>
          Save note
        </Button>
      </div>
    </div>
  )
}
