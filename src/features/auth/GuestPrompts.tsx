import { LockKeyhole, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { safeNextPath } from '@/utils/navigation'
import { GUEST_SAVE_LIMIT, startGuestSession, useGuestSaves } from './guest'

/** Where to come back to after signing up: straight back into saving `url`, if there is one. */
function authLink(path: '/signup' | '/login', url?: string): string {
  const link = url?.trim()
  return link ? `${path}?next=${encodeURIComponent(`/save?url=${encodeURIComponent(link)}`)}` : path
}

/** "Try without an account": starts a guest session and goes into the app. */
export function TryAsGuestButton({ next, className, children }: { next?: string | null; className?: string; children?: ReactNode }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  async function start() {
    setLoading(true)
    const { error } = await startGuestSession()
    setLoading(false)
    if (error) {
      toast.error(error)
      return
    }
    navigate(safeNextPath(next), { replace: true })
  }

  return (
    <button type="button" onClick={() => void start()} disabled={loading} className={cn('disabled:opacity-60', className)}>
      {loading ? 'Starting…' : (children ?? 'Try without an account')}
    </button>
  )
}

/** Slim strip at the top of the app while browsing as a guest. */
export function GuestSavesNotice() {
  const { isGuest, left } = useGuestSaves()
  if (!isGuest) return null
  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm">
      <UserRound className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
      <p className="min-w-0 flex-1 text-muted">
        <span className="font-medium text-fg">Guest mode.</span>{' '}
        {left > 0 ? `${left} of ${GUEST_SAVE_LIMIT} free saves left.` : 'You’ve used all your free saves.'}
      </p>
      <Link to="/signup" className="shrink-0 font-medium text-accent hover:underline">
        Sign up
      </Link>
    </div>
  )
}

/** One line under the Save form telling a guest how many saves remain. */
export function GuestSavesHint() {
  const { isGuest, left } = useGuestSaves()
  if (!isGuest) return null
  return (
    <p className="mt-3 text-center text-xs text-subtle">
      Guest mode: {left} of {GUEST_SAVE_LIMIT} free saves left.{' '}
      <Link to="/signup" className="font-medium text-fg hover:underline">
        Sign up
      </Link>{' '}
      to keep everything.
    </p>
  )
}

/** Shown in the Save sheet instead of the form once a guest has used every free save. */
export function GuestLimitPanel({ url, onNavigate }: { url?: string; onNavigate: () => void }) {
  return (
    <div className="flex flex-col items-center py-2 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-fg">
        <LockKeyhole className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">You’ve used your {GUEST_SAVE_LIMIT} free saves</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">
        Create a free account to keep saving. Your {GUEST_SAVE_LIMIT} saves come with you, and your link will be ready to save.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2">
        <Link
          to={authLink('/signup', url)}
          onClick={onNavigate}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-accent font-medium text-accent-fg hover:bg-accent-hover"
        >
          Sign up free
        </Link>
        <Link
          to={authLink('/login', url)}
          onClick={onNavigate}
          className="inline-flex h-12 items-center justify-center rounded-xl border border-line font-medium hover:bg-surface-2"
        >
          I have an account
        </Link>
      </div>
    </div>
  )
}

/** Settings → "Account" for guests: there's no profile yet, only the way to make one. */
export function GuestAccountCard() {
  const { used } = useGuestSaves()
  return (
    <div>
      <p className="text-sm text-muted">
        You’re trying Recall as a guest ({used} of {GUEST_SAVE_LIMIT} free saves used). Create a free account to keep your saves, use Recall on
        other devices, and save as much as you like. Everything you’ve saved comes with you.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link to="/signup" className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover">
          Sign up free
        </Link>
        <Link to="/login" className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2">
          Log in
        </Link>
      </div>
    </div>
  )
}
