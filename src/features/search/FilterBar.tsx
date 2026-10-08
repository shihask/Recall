import { CATEGORIES } from '@shared/categories.ts'
import { SOURCES } from '@shared/url.ts'
import { Heart, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCollections } from '@/features/collections/hooks'
import { useTags } from '@/features/tags/hooks'
import { cn } from '@/lib/cn'
import { SOURCE_LABELS } from '@/services/metadata/sourceLabels'
import type { SearchFilters } from '@/types/database'
import { DATE_PRESETS, type DatePreset } from './filters'

interface FilterBarProps {
  filters: SearchFilters
  datePreset: DatePreset
  onChange: (patch: Partial<SearchFilters>) => void
  onDatePreset: (preset: DatePreset) => void
  onClear: () => void
}

function Select({ label, value, onChange, children, active }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode; active: boolean }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 max-w-44 cursor-pointer appearance-none truncate rounded-xl border bg-surface pr-7 pl-3 text-sm transition-colors focus:ring-4 focus:ring-[var(--ring)] focus:outline-none',
          active ? 'border-accent text-accent-soft-fg' : 'border-line text-muted hover:border-line-strong',
        )}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] text-subtle" aria-hidden>
        ▼
      </span>
    </label>
  )
}

export function FilterBar({ filters, datePreset, onChange, onDatePreset, onClear }: FilterBarProps) {
  const { data: collections } = useCollections()
  const { data: tags } = useTags()
  const anyActive =
    !!filters.source || !!filters.category || !!filters.collection_id || !!filters.tag_id || !!filters.favorite || !!filters.include_archived || datePreset !== 'any'

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Filters">
      <div className="flex w-max items-center gap-2 sm:w-auto sm:flex-wrap">
        <Select label="Source" value={filters.source ?? ''} active={!!filters.source} onChange={(v) => onChange({ source: (v || null) as SearchFilters['source'] })}>
          <option value="">Any source</option>
          {SOURCES.filter((s) => s !== 'other').map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </Select>

        <Select label="Category" value={filters.category ?? ''} active={!!filters.category} onChange={(v) => onChange({ category: (v || null) as SearchFilters['category'] })}>
          <option value="">Any category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        {collections && collections.length > 0 && (
          <Select label="Collection" value={filters.collection_id ?? ''} active={!!filters.collection_id} onChange={(v) => onChange({ collection_id: v || null })}>
            <option value="">Any collection</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </option>
            ))}
          </Select>
        )}

        {tags && tags.length > 0 && (
          <Select label="Tag" value={filters.tag_id ?? ''} active={!!filters.tag_id} onChange={(v) => onChange({ tag_id: v || null })}>
            <option value="">Any tag</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}

        <Select label="Saved" value={datePreset} active={datePreset !== 'any'} onChange={(v) => onDatePreset(v as DatePreset)}>
          {DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>

        <button
          type="button"
          onClick={() => onChange({ favorite: !filters.favorite })}
          aria-pressed={!!filters.favorite}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm transition-colors',
            filters.favorite ? 'border-accent text-accent-soft-fg' : 'border-line text-muted hover:border-line-strong',
          )}
        >
          <Heart className={cn('h-3.5 w-3.5', filters.favorite && 'fill-current')} aria-hidden /> Favorites
        </button>

        <button
          type="button"
          onClick={() => onChange({ include_archived: !filters.include_archived })}
          aria-pressed={!!filters.include_archived}
          className={cn(
            'inline-flex h-9 items-center rounded-xl border px-3 text-sm transition-colors',
            filters.include_archived ? 'border-accent text-accent-soft-fg' : 'border-line text-muted hover:border-line-strong',
          )}
        >
          Include archived
        </button>

        <Select label="Sort" value={filters.sort ?? 'relevance'} active={false} onChange={(v) => onChange({ sort: v as 'relevance' | 'newest' })}>
          <option value="relevance">Best match</option>
          <option value="newest">Newest</option>
        </Select>

        {anyActive && (
          <button type="button" onClick={onClear} className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-sm text-muted hover:text-fg">
            <X className="h-3.5 w-3.5" aria-hidden /> Clear
          </button>
        )}
      </div>
    </div>
  )
}
