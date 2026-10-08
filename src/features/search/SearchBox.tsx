import { Loader2, Search, X } from 'lucide-react'
import { forwardRef, type FormEvent } from 'react'
import { cn } from '@/lib/cn'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  loading?: boolean
  size?: 'md' | 'lg'
  className?: string
}

export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(function SearchBox(
  { value, onChange, onSubmit, placeholder = 'What are you trying to remember?', autoFocus, loading, size = 'lg', className },
  ref,
) {
  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit?.(value)
  }
  return (
    <form role="search" onSubmit={submit} className={cn('relative', className)}>
      <Search
        className={cn('pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-subtle', size === 'lg' ? 'h-5 w-5' : 'h-4 w-4')}
        aria-hidden
      />
      <input
        ref={ref}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search your memory"
        enterKeyHint="search"
        autoComplete="off"
        maxLength={300}
        className={cn(
          'w-full rounded-2xl border border-line bg-surface text-fg shadow-soft transition-colors placeholder:text-subtle',
          'focus:border-accent focus:ring-4 focus:ring-[var(--ring)] focus:outline-none [&::-webkit-search-cancel-button]:hidden',
          size === 'lg' ? 'h-14 pr-12 pl-12 text-[17px]' : 'h-11 pr-10 pl-10 text-[15px]',
        )}
      />
      <div className="absolute top-1/2 right-3 -translate-y-1/2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-subtle" aria-hidden />
        ) : (
          value && (
            <button type="button" onClick={() => onChange('')} className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )
        )}
      </div>
    </form>
  )
})
