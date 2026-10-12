import { Ellipsis, EllipsisVertical, Menu, Share, SquarePlus, X, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/cn'
import {
  currentBrowser,
  isStandalone,
  promptInstall,
  readSnoozed,
  snoozeBanner,
  useCanPromptInstall,
  useJustInstalled,
  type InstallBrowser,
} from './install'

function Key({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <strong className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-fg">
      {Icon && (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line bg-surface-2">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
      {children}
    </strong>
  )
}

function steps(browser: InstallBrowser): ReactNode[] {
  switch (browser) {
    case 'safari':
      return [
        <>
          Tap <Key icon={Share}>Share</Key> in Safari’s toolbar. If you don’t see it, tap <Key icon={Ellipsis}>More</Key> first.
        </>,
        <>
          Scroll down and tap <Key icon={SquarePlus}>Add to Home Screen</Key>.
        </>,
        <>
          Tap <Key>Add</Key>. Recall appears on your Home Screen.
        </>,
      ]
    case 'ios-other':
      return [
        <>
          Tap <Key icon={Share}>Share</Key> in the address bar (or in the <Key icon={Ellipsis}>More</Key> menu).
        </>,
        <>
          Tap <Key icon={SquarePlus}>Add to Home Screen</Key>. Not there? Open this page in Safari and try again.
        </>,
        <>
          Tap <Key>Add</Key>.
        </>,
      ]
    case 'samsung':
      return [
        <>
          Tap <Key icon={Menu}>Menu</Key> at the bottom of the screen.
        </>,
        <>
          Tap <Key>Add page to</Key>, then <Key>Home screen</Key>.
        </>,
        <>
          Tap <Key>Add</Key>.
        </>,
      ]
    case 'firefox':
      return [
        <>
          Tap <Key icon={EllipsisVertical}>Menu</Key>.
        </>,
        <>
          Tap <Key>Install</Key> (or <Key>Add to Home screen</Key>).
        </>,
        <>Confirm, and Recall appears on your home screen.</>,
      ]
    case 'in-app':
      return [
        <>
          You’re in another app’s built-in browser, which can’t install apps. Tap <Key icon={Ellipsis}>More</Key> (or{' '}
          <Key icon={EllipsisVertical}>Menu</Key>) at the top.
        </>,
        <>
          Tap <Key>Open in browser</Key> (it may say Open in Safari or Open in Chrome).
        </>,
        <>Then install Recall from there. These directions will show again.</>,
      ]
    case 'chrome':
      return [
        <>
          Tap <Key icon={EllipsisVertical}>Menu</Key> at the top right.
        </>,
        <>
          Tap <Key>Install app</Key> (or <Key>Add to Home screen</Key>).
        </>,
        <>
          Tap <Key>Install</Key>. Recall appears with your other apps.
        </>,
      ]
  }
}

const TIPS: Partial<Record<InstallBrowser, string>> = {
  safari: 'Then, in Recall’s Settings, add “Save to Recall” to your Share menu.',
  'ios-other': 'Then, in Recall’s Settings, add “Save to Recall” to your Share menu.',
  chrome: 'Then share any post or link to Recall straight from the Share menu.',
  samsung: 'Then share any post or link to Recall straight from the Share menu.',
  firefox: 'Then share any post or link to Recall straight from the Share menu.',
}

/** Step-by-step "Add to Home Screen" directions for the browser in use. */
export function InstallGuide({ open, onOpenChange, browser }: { open: boolean; onOpenChange: (open: boolean) => void; browser: InstallBrowser }) {
  const ios = browser === 'safari' || browser === 'ios-other'
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={ios ? 'Add Recall to your Home Screen' : 'Install Recall'}
      description="It opens full screen like an app, with no browser bars."
    >
      <ol className="space-y-4">
        {steps(browser).map((step, i) => (
          <li key={i} className="flex gap-3 text-sm leading-7 text-muted">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-fg">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {TIPS[browser] && <p className="mt-5 rounded-xl bg-surface-2 p-3 text-sm text-muted">{TIPS[browser]}</p>}
      <Button className="mt-5 w-full" onClick={() => onOpenChange(false)}>
        Got it
      </Button>
    </Dialog>
  )
}

/** Opens the browser's install dialog when there is one, otherwise the directions. */
function useInstall() {
  const [browser] = useState(currentBrowser)
  const canPrompt = useCanPromptInstall()
  const [guideOpen, setGuideOpen] = useState(false)

  async function install() {
    if (canPrompt && (await promptInstall())) {
      toast.success('Recall is installed.')
      return
    }
    if (!canPrompt) setGuideOpen(true)
  }

  const guide = browser ? <InstallGuide open={guideOpen} onOpenChange={setGuideOpen} browser={browser} /> : null
  return { browser, canPrompt, install, guide }
}

/** Phone-only banner inviting people to install Recall. Hidden once installed or after "×" (for 14 days). */
export function InstallBanner({ className }: { className?: string }) {
  const { browser, install, guide } = useInstall()
  const justInstalled = useJustInstalled()
  const [hidden, setHidden] = useState(() => isStandalone() || readSnoozed())

  if (!browser || hidden || justInstalled) return guide

  return (
    <>
      <div
        role="region"
        aria-label="Install Recall"
        className={cn(
          'fixed inset-x-3 z-40 mx-auto flex max-w-md animate-fade-in items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-lift',
          className,
        )}
      >
        <LogoMark className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Install Recall</p>
          <p className="text-xs text-muted">
            {browser === 'in-app' ? 'Open in your browser to install.' : 'Open it like an app and save from the Share menu.'}
          </p>
        </div>
        <Button size="sm" onClick={() => void install()}>
          {browser === 'in-app' ? 'How' : 'Install'}
        </Button>
        <button
          type="button"
          aria-label="Not now"
          onClick={() => {
            snoozeBanner()
            setHidden(true)
          }}
          className="-mr-1 rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {guide}
    </>
  )
}

/** Settings → "Install the app". Renders nothing when already installed or nothing applies. */
export function InstallSetting() {
  const { browser, canPrompt, install, guide } = useInstall()
  const justInstalled = useJustInstalled()
  const [standalone] = useState(isStandalone)

  if (standalone || justInstalled || (!browser && !canPrompt)) return null

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-semibold tracking-tight">Install the app</h2>
          <p className="mt-1 text-sm text-muted">Open Recall from your home screen, full screen, and share links straight to it.</p>
        </div>
        <Button size="sm" onClick={() => void install()}>
          {canPrompt ? 'Install' : 'How to install'}
        </Button>
      </div>
      {guide}
    </section>
  )
}
