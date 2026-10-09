import { analyzeUrl, displayHost, extractUrlFromText, type AnalyzedUrl } from '@shared/url.ts'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, ChevronDown, ClipboardPaste } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { SourceIcon } from '@/components/SourceIcon'
import { Thumbnail } from '@/components/Thumbnail'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FieldError, Input, Label, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/misc'
import { CollectionPicker } from '@/features/collections/CollectionPicker'
import { TagInput } from '@/features/tags/TagInput'
import { cn } from '@/lib/cn'
import { qk } from '@/lib/queryKeys'
import { describeSource, placeholderTitle } from '@/services/metadata/sourceLabels'
import { errorMessage } from '@/services/supabase/errors'
import { findDuplicate, type DuplicateMatch } from '@/services/supabase/items'
import { savedAgo } from '@/utils/dates'
import { isProcessing, useCreateItem, useItem } from './hooks'
import { NoteEditor } from './NoteEditor'
import { ProcessingCard } from './ProcessingCard'
import { useProcessingStep } from './processing-step'
import { needsNote, previewlessTitle } from './useSaveNote'
import type { SavePrefill } from './save-sheet-context'

interface SaveSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefill: SavePrefill | null
  /** Changes on every open, remounting the flow so it starts fresh from the prefill. */
  session: number
}

type Step = { kind: 'form' } | { kind: 'duplicate'; match: DuplicateMatch; analyzed: AnalyzedUrl } | { kind: 'saved'; itemId: string }

const canReadClipboard = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText

export function SaveSheet({ open, onOpenChange, prefill, session }: SaveSheetProps) {
  const [saved, setSaved] = useState(false)
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={saved ? 'Saved' : 'Save something'}
      hideHeader={saved}
      // The URL input focuses itself (autoFocus); skip Radix's default of the close button.
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <SaveFlow key={session} prefill={prefill} onClose={() => onOpenChange(false)} onSavedChange={setSaved} />
    </Dialog>
  )
}

function SaveFlow({ prefill, onClose, onSavedChange }: { prefill: SavePrefill | null; onClose: () => void; onSavedChange: (saved: boolean) => void }) {
  const [url, setUrl] = useState(prefill?.url ?? '')
  const [note, setNote] = useState(prefill?.note ?? '')
  const [tags, setTags] = useState<string[]>([])
  const [collectionIds, setCollectionIds] = useState<string[]>(prefill?.collectionId ? [prefill.collectionId] : [])
  const [showDetails, setShowDetails] = useState(!!prefill?.note || !!prefill?.collectionId)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'form' })
  const urlRef = useRef<HTMLInputElement>(null)
  const ids = { url: useId(), note: useId(), tags: useId(), error: useId() }
  const create = useCreateItem()
  const queryClient = useQueryClient()

  useEffect(() => onSavedChange(step.kind === 'saved'), [step.kind, onSavedChange])

  const analyzed = url.trim() ? analyzeUrl(url) : null
  const detected = analyzed?.ok ? analyzed.value : null

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      const found = extractUrlFromText(text) ?? text.trim()
      setUrl(found)
      setError(null)
      urlRef.current?.focus()
    } catch {
      setError('Couldn’t read your clipboard. Paste the link with your keyboard instead.')
    }
  }

  async function doSave(target: AnalyzedUrl) {
    try {
      const { item } = await create.mutateAsync({ analyzed: target, note, tagNames: tags, collectionIds })
      setStep({ kind: 'saved', itemId: item.id })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    // Accept a whole shared blurb ("Look at this! https://…") as well as a bare link.
    const input = extractUrlFromText(url) ?? url
    const result = analyzeUrl(input)
    if (!result.ok) {
      setError(result.error)
      urlRef.current?.focus()
      return
    }
    setError(null)
    setChecking(true)
    try {
      const match = await queryClient.fetchQuery({
        queryKey: qk.duplicate(result.value.canonicalUrl),
        queryFn: () => findDuplicate(result.value.canonicalUrl),
        staleTime: 0,
      })
      if (match) {
        setStep({ kind: 'duplicate', match, analyzed: result.value })
        return
      }
    } catch {
      // Duplicate check is a courtesy — never block a save on it.
    } finally {
      setChecking(false)
    }
    await doSave(result.value)
  }

  const busy = checking || create.isPending

  return (
    <>
      {step.kind === 'saved' ? (
        <SavedView
          itemId={step.itemId}
          onDone={() => onClose()}
          onAnother={() => {
            setUrl('')
            setNote('')
            setTags([])
            setCollectionIds([])
            setStep({ kind: 'form' })
            requestAnimationFrame(() => urlRef.current?.focus())
          }}
        />
      ) : step.kind === 'duplicate' ? (
        <DuplicateView
          match={step.match}
          saving={create.isPending}
          onSaveAgain={() => void doSave(step.analyzed)}
          onClose={() => onClose()}
          onBack={() => setStep({ kind: 'form' })}
        />
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <Label htmlFor={ids.url}>Paste a link</Label>
          <div className="relative">
            <Input
              ref={urlRef}
              autoFocus
              id={ids.url}
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
              placeholder="https://…"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setError(null)
              }}
              aria-invalid={!!error}
              aria-describedby={error ? ids.error : undefined}
              className={cn('h-12 text-base', canReadClipboard && 'pr-24')}
            />
            {canReadClipboard && !url && (
              <button
                type="button"
                onClick={pasteFromClipboard}
                className="absolute top-1/2 right-2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-fg"
              >
                <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
                Paste
              </button>
            )}
          </div>
          <FieldError id={ids.error}>{error}</FieldError>
          <div className="mt-2 h-6" aria-live="polite">
            {detected && (
              <Badge>
                <SourceIcon source={detected.source} type={detected.sourceType} className="h-3.5 w-3.5" />
                {detected.source === 'website' ? displayHost(detected.url) : describeSource(detected.source, detected.sourceType)}
              </Badge>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
            aria-expanded={showDetails}
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', showDetails && 'rotate-180')} aria-hidden />
            Add a note, collection or tags
          </button>

          {showDetails && (
            <div className="mt-4 space-y-5">
              <div>
                <Label htmlFor={ids.note} hint="Helps you find it later">
                  Note
                </Label>
                <Textarea id={ids.note} placeholder="Why am I saving this?" value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium">Collection</p>
                <CollectionPicker
                  selected={collectionIds}
                  onToggle={(id, on) => setCollectionIds((cur) => (on ? [...new Set([...cur, id])] : cur.filter((c) => c !== id)))}
                />
              </div>
              <div>
                <Label htmlFor={ids.tags}>Tags</Label>
                <TagInput id={ids.tags} value={tags} onChange={setTags} />
              </div>
            </div>
          )}

          <Button type="submit" size="lg" className="mt-6 w-full" loading={busy} disabled={!url.trim()}>
            Save
          </Button>
        </form>
      )}
    </>
  )
}

function DuplicateView({
  match,
  saving,
  onSaveAgain,
  onClose,
  onBack,
}: {
  match: DuplicateMatch
  saving: boolean
  onSaveAgain: () => void
  onClose: () => void
  onBack: () => void
}) {
  const navigate = useNavigate()
  return (
    <div>
      <div className="rounded-2xl border border-line bg-surface-2 p-4">
        <p className="font-medium">You already saved this.</p>
        <p className="mt-1 text-sm text-muted">
          {savedAgo(match.saved_at)}
          {match.is_archived && ' · in your archive'}
        </p>
        {match.title && <p className="mt-3 line-clamp-2 text-sm">{match.title}</p>}
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <Button
          size="lg"
          onClick={() => {
            onClose()
            navigate(`/item/${match.id}`)
          }}
        >
          Open existing save
        </Button>
        <Button size="lg" variant="outline" onClick={onSaveAgain} loading={saving}>
          Save again anyway
        </Button>
        <Button variant="ghost" onClick={onBack} disabled={saving}>
          Back
        </Button>
      </div>
    </div>
  )
}

function SavedView({ itemId, onDone, onAnother }: { itemId: string; onDone: () => void; onAnother: () => void }) {
  const navigate = useNavigate()
  const { data: item } = useItem(itemId)
  const processing = !item || isProcessing(item)
  const ready = item?.processing_status === 'ready'
  const host = item ? displayHost(item.url) : ''
  const step = useProcessingStep(item)

  return (
    <div className="pt-2" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold tracking-tight">{ready ? 'Ready' : 'Saved to Recall'}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            {processing ? (
              'Recall is reading it for you…'
            ) : ready ? (
              'Summarized and tagged.'
            ) : item && needsNote(item) ? (
              'Saved. There’s no preview to read, so a note will help you find it.'
            ) : item?.processing_status === 'partial' ? (
              'We saved the link, but couldn’t retrieve everything. You can still organize and find it.'
            ) : (
              'Saved successfully. AI processing will be retried later.'
            )}
          </p>
        </div>
      </div>

      {processing ? (
        <ProcessingCard item={item} step={step} />
      ) : (
        <div className="mt-5 flex animate-fade-in gap-3 rounded-2xl border border-line p-3">
          <Thumbnail src={item.thumbnail_url} source={item.source} type={item.source_type} className="h-16 w-16 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-medium">{item.title || placeholderTitle(item.source, item.source_type, host)}</p>
            <p className="mt-0.5 text-sm text-muted">{describeSource(item.source, item.source_type)}</p>
            {item.tags.length > 0 && <p className="mt-1 truncate text-xs text-subtle">{item.tags.map((t) => t.name).join(' • ')}</p>}
          </div>
        </div>
      )}

      {item && !processing && needsNote(item) && (
        <div className="mt-4 rounded-2xl bg-surface-2 p-4">
          <p className="text-sm font-medium">{previewlessTitle(item.source)}</p>
          <p className="mt-0.5 mb-3 text-sm text-muted">What was it about? A few words is enough — Recall will tag it and find it later.</p>
          <NoteEditor item={item} startEditing placeholder="e.g. 3D printed phone mount for my bike" />
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" onClick={onAnother}>
          Save another
        </Button>
        <Button
          size="lg"
          onClick={() => {
            onDone()
            navigate(`/item/${itemId}`)
          }}
        >
          View <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <Button variant="ghost" className="mt-2 w-full" onClick={onDone}>
        Done
      </Button>
    </div>
  )
}
