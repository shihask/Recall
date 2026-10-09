import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Bookmark, Brain, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { useCollections, useCreateInterestCollections } from '@/features/collections/hooks'
import { InterestPicker } from '@/features/collections/InterestPicker'
import { existingInterestIds, interestsToCreate } from '@/features/collections/interests'
import { ManageCollectionsList } from '@/features/collections/ManageCollectionsList'
import { useUpdateProfile } from '@/features/settings/profileHooks'
import { cn } from '@/lib/cn'
import { qk } from '@/lib/queryKeys'
import type { ProfileRow } from '@/types/database'

const SCREENS = [
  { icon: Brain, title: 'Welcome to Recall.', body: 'Your personal memory for the internet.' },
  { icon: Bookmark, title: 'Save anything you want to remember.', body: 'Paste a link from Instagram, YouTube, Reddit, X or anywhere. A note is optional.' },
  { icon: Search, title: 'Find it later by simply describing what you remember.', body: '“That Reel about a 3D printed phone mount for my bike.”' },
]

// Intro screens, then "what do you save?", then a review of the collections it made.
const INTERESTS_STEP = SCREENS.length
const REVIEW_STEP = SCREENS.length + 1
const STEP_COUNT = SCREENS.length + 2

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const navigate = useNavigate()
  const update = useUpdateProfile()
  const queryClient = useQueryClient()
  const { data: collections = [] } = useCollections()
  const createInterests = useCreateInterestCollections()

  const existingNames = collections.map((c) => c.name)
  const toCreate = interestsToCreate(selected, existingNames)

  function finish() {
    const onboarded_at = new Date().toISOString()
    // Mark the cached profile first, synchronously: the app's OnboardingGate
    // reads it right after this navigate, and a stale null sent users back here.
    queryClient.setQueryData<ProfileRow | null>(qk.profile(), (p) => (p ? { ...p, onboarded_at } : p))
    // Don't block on the write itself.
    update.mutate({ onboarded_at })
    navigate('/home?save=1', { replace: true })
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function createAndReview() {
    if (toCreate.length === 0) return setStep(REVIEW_STEP)
    createInterests.mutate(toCreate, { onSuccess: () => setStep(REVIEW_STEP) })
  }

  const intro = step < INTERESTS_STEP
  const screen = intro ? SCREENS[step]! : null

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-safe pb-safe">
      <div className="flex h-16 items-center justify-between">
        <LogoMark />
        {step !== REVIEW_STEP && (
          // Skipping the intro still lands on interests; skipping interests finishes.
          <button type="button" onClick={() => (intro ? setStep(INTERESTS_STEP) : finish())} className="text-sm text-muted hover:text-fg">
            Skip
          </button>
        )}
      </div>

      <div className={cn('mx-auto flex w-full flex-1 flex-col', intro ? 'max-w-md items-center justify-center text-center' : 'max-w-xl py-4')} aria-live="polite">
        {screen ? (
          <div key={step} className="animate-fade-in">
            <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-soft text-accent-soft-fg">
              <screen.icon className="h-8 w-8" aria-hidden />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{screen.title}</h1>
            <p className="mt-3 text-muted">{screen.body}</p>
          </div>
        ) : step === INTERESTS_STEP ? (
          <div key="interests" className="animate-fade-in">
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">What do you like to save?</h1>
            <p className="mt-2 mb-6 text-muted">Pick a few. Each becomes a collection, and Recall files matching saves into it for you.</p>
            <InterestPicker selected={selected} onToggle={toggle} existing={existingInterestIds(existingNames)} />
          </div>
        ) : (
          <div key="review" className="animate-fade-in">
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Your collections</h1>
            <p className="mt-2 mb-6 text-muted">Rename, change or delete any of them. You can always manage them later in Collections.</p>
            <ManageCollectionsList />
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-md pb-8">
        <div className="mb-6 flex justify-center gap-1.5" aria-hidden>
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-accent' : 'w-1.5 bg-line-strong')} />
          ))}
        </div>
        {intro ? (
          <Button size="lg" className="w-full" onClick={() => setStep((s) => s + 1)}>
            Continue <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : step === INTERESTS_STEP ? (
          <Button size="lg" className="w-full" loading={createInterests.isPending} onClick={createAndReview}>
            {toCreate.length === 0 ? 'Continue' : toCreate.length === 1 ? 'Create 1 collection' : `Create ${toCreate.length} collections`}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={finish}>
            Start saving <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  )
}
