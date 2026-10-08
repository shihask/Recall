import { X } from 'lucide-react'
import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'
import { MAX_TAG_LENGTH, normalizeTagNames } from '@/services/supabase/tags'
import { useTags } from './hooks'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  id?: string
  placeholder?: string
  autoFocus?: boolean
}

/** Chips + free text. Enter or comma adds; Backspace on empty removes the last. */
export function TagInput({ value, onChange, id, placeholder = 'Add tags…', autoFocus }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const { data: allTags } = useTags()
  const listId = useId()

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase()
    if (!q || !allTags) return []
    const chosen = new Set(value.map((v) => v.toLowerCase()))
    return allTags.filter((t) => t.name.toLowerCase().includes(q) && !chosen.has(t.name.toLowerCase())).slice(0, 6)
  }, [draft, allTags, value])

  function add(raw: string) {
    const next = normalizeTagNames([...value, ...raw.split(',')])
    onChange(next.slice(0, 20))
    setDraft('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && draft.trim()) {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          'flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-1.5 transition-colors',
          focused && 'border-accent ring-4 ring-[var(--ring)]',
        )}
      >
        {value.map((tag) => (
          <span key={tag.toLowerCase()} className="inline-flex items-center gap-1 rounded-lg bg-surface-2 py-1 pr-1 pl-2.5 text-sm">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="rounded p-0.5 text-subtle hover:bg-surface-3 hover:text-fg"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          autoFocus={autoFocus}
          maxLength={MAX_TAG_LENGTH * 2}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            if (draft.trim()) add(draft)
          }}
          placeholder={value.length ? '' : placeholder}
          className="h-8 min-w-24 flex-1 bg-transparent px-1.5 text-[15px] placeholder:text-subtle focus:outline-none"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </div>
      {focused && suggestions.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lift">
          {suggestions.map((t) => (
            <li key={t.id} role="option" aria-selected={false}>
              <button
                type="button"
                // mousedown fires before the input's blur, so the click isn't lost.
                onMouseDown={(e) => {
                  e.preventDefault()
                  add(t.name)
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                {t.name}
                <span className="text-xs text-subtle">{t.item_count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
