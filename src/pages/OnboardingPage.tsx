import { ArrowRight, Bookmark, Brain, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { useUpdateProfile } from '@/features/settings/profileHooks'
import { cn } from '@/lib/cn'

const SCREENS = [
  { icon: Brain, title: 'Welcome to Recall.', body: 'Your personal memory for the internet.' },
  { icon: Bookmark, title: 'Save anything you want to remember.', body: 'Paste a link from Instagram, YouTube, Reddit, X or anywhere. A note is optional.' },
  { icon: Search, title: 'Find it later by simply describing what you remember.', body: '“That Reel about a 3D printed phone mount for my bike.”' },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const update = useUpdateProfile()
  const screen = SCREENS[step]!
  const last = step === SCREENS.length - 1
  const Icon = screen.icon

  function finish() {
    // Don't block on the write; worst case onboarding shows once more.
    update.mutate({ onboarded_at: new Date().toISOString() })
    navigate('/home?save=1', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-safe pb-safe">
      <div className="flex h-16 items-center justify-between">
        <LogoMark />
        {!last && (
          <button type="button" onClick={finish} className="text-sm text-muted hover:text-fg">
            Skip
          </button>
        )}
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center" aria-live="polite">
        <div key={step} className="animate-fade-in">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-soft text-accent-soft-fg">
            <Icon className="h-8 w-8" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{screen.title}</h1>
          <p className="mt-3 text-muted">{screen.body}</p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-md pb-8">
        <div className="mb-6 flex justify-center gap-1.5" aria-hidden>
          {SCREENS.map((_, i) => (
            <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-accent' : 'w-1.5 bg-line-strong')} />
          ))}
        </div>
        <Button size="lg" className="w-full" onClick={() => (last ? finish() : setStep((s) => s + 1))}>
          {last ? 'Start saving' : 'Continue'} <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
