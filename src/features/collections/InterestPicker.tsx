import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { INTERESTS } from './interests'

interface InterestPickerProps {
  selected: ReadonlySet<string>
  onToggle: (id: string) => void
  /** Interests that already exist as collections: shown as added, not selectable. */
  existing?: ReadonlySet<string>
}

/** Multi-select grid of starter interests. */
export function InterestPicker({ selected, onToggle, existing }: InterestPickerProps) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Interests">
      {INTERESTS.map((i) => {
        const added = existing?.has(i.id) ?? false
        const on = added || selected.has(i.id)
        return (
          <li key={i.id}>
            <button
              type="button"
              aria-pressed={on}
              disabled={added}
              onClick={() => onToggle(i.id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                on ? 'border-accent bg-accent-soft text-accent-soft-fg' : 'border-line bg-surface hover:bg-surface-2',
                added && 'cursor-default opacity-70',
              )}
            >
              <span className="text-lg" aria-hidden>
                {i.icon}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{i.name}</span>
              {on && <Check className="h-4 w-4 shrink-0" aria-hidden />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
