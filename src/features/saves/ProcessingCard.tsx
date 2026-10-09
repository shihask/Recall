import { Sparkles } from 'lucide-react'
import { Thumbnail } from '@/components/Thumbnail'
import type { SavedItem } from '@/types/domain'
import { PROCESSING_STEPS } from './processing-step'

/** The just-saved item while the server works on it: brand-colour sweep, progress bar, live step. */
export function ProcessingCard({ item, step }: { item: SavedItem | null | undefined; step: number }) {
  return (
    <div className="relative mt-5 overflow-hidden rounded-2xl border border-accent/30 bg-accent-soft/60 p-3" role="status">
      <div aria-hidden className="pointer-events-none absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-accent/15 to-transparent" />

      <div className="relative flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-accent-soft">
          {item?.thumbnail_url ? (
            <Thumbnail src={item.thumbnail_url} source={item.source} type={item.source_type} className="h-full w-full animate-fade-in" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-accent">
              <Sparkles className="h-6 w-6 animate-glow" aria-hidden />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          {item?.title ? (
            <p className="line-clamp-2 animate-fade-in font-medium">{item.title}</p>
          ) : (
            <div className="space-y-2 pt-1" aria-hidden>
              <div className="h-3 w-3/4 rounded-full bg-accent/20" />
              <div className="h-3 w-1/2 rounded-full bg-accent/15" />
            </div>
          )}
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-accent">
            <span className="h-1.5 w-1.5 animate-glow rounded-full bg-accent" aria-hidden />
            <span key={step} className="animate-fade-in">
              {PROCESSING_STEPS[step]}…
            </span>
          </p>
        </div>
      </div>

      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-accent/15">
        <div className="h-full w-full origin-left animate-progress bg-accent" />
      </div>
    </div>
  )
}
