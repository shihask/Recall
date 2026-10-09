import { ChevronDown, ClipboardCheck, Share } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import {
  clipboardAccess,
  isDetectEnabled,
  isOpenOnLaunchEnabled,
  requestClipboardAccess,
  setDetectEnabled,
  setOpenOnLaunchEnabled,
  type ClipboardAccess,
} from '@/features/saves/clipboard'
import { cn } from '@/lib/cn'

const SAVE_URL = `${window.location.origin}/save?url=`

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line-strong')}
    >
      <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform', checked && 'translate-x-5')} />
    </button>
  )
}

function Row({ title, children, control }: { title: string; children: ReactNode; control?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <div className="mt-0.5 text-sm text-muted">{children}</div>
      </div>
      {control}
    </div>
  )
}

function CopiedLinks() {
  const [access, setAccess] = useState<ClipboardAccess | null>(null)
  const [enabled, setEnabled] = useState(isDetectEnabled)

  useEffect(() => {
    void clipboardAccess().then(setAccess)
  }, [])

  async function allow() {
    const state = await requestClipboardAccess()
    setAccess(state)
    if (state === 'granted') {
      setDetectEnabled(true)
      setEnabled(true)
      toast.success('Done. Copy a link anywhere, then open Recall.')
    }
  }

  const description =
    access === 'unsupported'
      ? 'Not available in this browser. iPhone and iPad never allow it. Use the options below instead.'
      : access === 'denied'
        ? 'Clipboard access is blocked for this site. Allow it in your browser’s site settings to turn this on.'
        : 'Copy a link in any app, then open Recall: the Save box opens with the link filled in.'

  return (
    <Row
      title="Detect copied links"
      control={
        access === 'granted' ? (
          <Switch
            checked={enabled}
            label="Detect copied links"
            onChange={(on) => {
              setDetectEnabled(on)
              setEnabled(on)
            }}
          />
        ) : access === 'prompt' ? (
          <Button size="sm" onClick={() => void allow()}>
            <ClipboardCheck className="h-4 w-4" aria-hidden /> Allow
          </Button>
        ) : null
      }
    >
      {description}
    </Row>
  )
}

function OpenOnLaunch() {
  const [on, setOn] = useState(isOpenOnLaunchEnabled)
  return (
    <Row
      title="Open Save when I open Recall"
      control={
        <Switch
          checked={on}
          label="Open Save when I open Recall"
          onChange={(next) => {
            setOpenOnLaunchEnabled(next)
            setOn(next)
          }}
        />
      }
    >
      Best on iPhone: copy a link, open Recall, tap <strong className="font-medium text-fg">Paste</strong>, then Save.
    </Row>
  )
}

function IphoneShortcut() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl bg-surface-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left">
        <Share className="h-5 w-5 shrink-0 text-accent" aria-hidden />
        <span className="flex-1">
          <span className="block text-sm font-medium">iPhone: “Save to Recall” in the Share menu</span>
          <span className="block text-sm text-muted">Share any post or link straight to Recall. No copying.</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-subtle transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="animate-fade-in px-4 pb-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-muted marker:text-subtle">
            <li>
              Open the <strong className="font-medium text-fg">Shortcuts</strong> app and tap <strong className="font-medium text-fg">+</strong>.
              Name it <strong className="font-medium text-fg">Save to Recall</strong>.
            </li>
            <li>
              Tap <strong className="font-medium text-fg">ⓘ</strong> (details), turn on <strong className="font-medium text-fg">Show in Share Sheet</strong>,
              and set it to receive <strong className="font-medium text-fg">URLs</strong> and <strong className="font-medium text-fg">Text</strong>.
            </li>
            <li>
              Add the action <strong className="font-medium text-fg">URL Encode</strong> (it uses the Shortcut Input).
            </li>
            <li>
              Add the action <strong className="font-medium text-fg">Text</strong> and type the address below, then insert the
              <strong className="font-medium text-fg"> URL Encoded Text</strong> variable at the end:
              <code className="mt-1.5 block rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs break-all text-fg">{SAVE_URL}</code>
            </li>
            <li>
              Add the action <strong className="font-medium text-fg">Open URLs</strong>, then tap Done.
            </li>
          </ol>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(SAVE_URL)
                .then(() => toast.success('Address copied.'))
                .catch(() => toast.error('Couldn’t copy. Long-press the address to copy it.'))
            }
          >
            Copy the address
          </Button>
          <p className="mt-3 text-xs text-subtle">
            Shortcuts open links in Safari, so sign in to Recall in Safari once too. Your saves are the same everywhere.
          </p>
        </div>
      )}
    </div>
  )
}

/** Settings → "Saving from other apps". */
export function SaveFromAppsSettings() {
  return (
    <div className="space-y-5">
      <CopiedLinks />
      <OpenOnLaunch />
      <IphoneShortcut />
      <p className="text-sm text-muted">
        <strong className="font-medium text-fg">Android:</strong> install Recall from your browser’s menu (Add to Home screen), then use Share →
        Recall in any app.
      </p>
    </div>
  )
}
