import { Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { SavedItem } from '@/types/domain'
import { useAddItemTags, useRemoveItemTag } from './hooks'
import { TagInput } from './TagInput'

export function ItemTagsEditor({ item }: { item: SavedItem }) {
  const add = useAddItemTags()
  const remove = useRemoveItemTag()
  const [adding, setAdding] = useState<string[]>([])

  return (
    <div className="space-y-3">
      {item.tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <li key={tag.id} className="inline-flex items-center rounded-lg bg-surface-2 text-sm">
              <Link to={`/tags/${tag.id}`} className="inline-flex items-center gap-1 py-1 pl-2.5 hover:underline">
                {tag.origin === 'ai' && <Sparkles className="h-3 w-3 text-subtle" aria-label="Suggested by AI" />}
                {tag.name}
              </Link>
              <button
                type="button"
                onClick={() => remove.mutate({ itemId: item.id, tagId: tag.id })}
                className="mx-0.5 rounded p-1 text-subtle hover:bg-surface-3 hover:text-fg"
                aria-label={`Remove tag ${tag.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <TagInput
        value={adding}
        placeholder="Add a tag and press Enter"
        onChange={(next) => {
          // Commit immediately: each new chip becomes a real tag on the item.
          const fresh = next.filter((n) => !item.tags.some((t) => t.name.toLowerCase() === n.toLowerCase()))
          if (fresh.length) add.mutate({ itemId: item.id, names: fresh })
          setAdding([])
        }}
      />
    </div>
  )
}
