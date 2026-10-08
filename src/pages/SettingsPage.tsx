import { Download, LogOut, Monitor, Moon, Sparkles, Sun } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FieldError, Input, Label } from '@/components/ui/Input'
import { PageHeader, Skeleton } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/auth-context'
import { useProfile, useUpdateProfile } from '@/features/settings/profileHooks'
import { useTheme, type ThemePreference } from '@/features/settings/theme'
import { cn } from '@/lib/cn'
import { downloadFile, fetchAllForExport, toCsv, toJson } from '@/services/export/exportData'
import { errorMessage } from '@/services/supabase/errors'
import { deleteAccount } from '@/services/supabase/profiles'
import type { ProfileRow } from '@/types/database'
import { safeHttpUrl } from '@/utils/safeUrl'

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Avatar({ profile, email }: { profile: ProfileRow | null | undefined; email: string }) {
  const src = safeHttpUrl(profile?.avatar_url)
  const [failed, setFailed] = useState(false)
  const initial = (profile?.display_name || email || '?').trim().charAt(0).toUpperCase()
  return src && !failed ? (
    <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-14 w-14 rounded-full object-cover" />
  ) : (
    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-xl font-semibold text-accent-soft-fg" aria-hidden>
      {initial}
    </span>
  )
}

function AccountForm({ profile, email }: { profile: ProfileRow | null; email: string }) {
  const update = useUpdateProfile()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [avatar, setAvatar] = useState(profile?.avatar_url ?? '')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await update.mutateAsync({ display_name: name.trim().slice(0, 80) || null, avatar_url: avatar.trim() || null })
      toast.success('Profile saved')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar profile={profile} email={email} />
        <div className="min-w-0">
          <p className="truncate font-medium">{profile?.display_name || 'No name yet'}</p>
          <p className="truncate text-sm text-muted">{email}</p>
        </div>
      </div>
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} readOnly disabled />
      </div>
      <div>
        <Label htmlFor="avatar" hint="Optional">
          Avatar image URL
        </Label>
        <Input id="avatar" type="url" inputMode="url" placeholder="https://…" value={avatar} onChange={(e) => setAvatar(e.target.value)} aria-invalid={!!error} />
        <FieldError id="avatar-error">{error}</FieldError>
      </div>
      <Button type="submit" loading={update.isPending}>
        Save profile
      </Button>
    </form>
  )
}

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

function ExportButtons() {
  const [busy, setBusy] = useState<'json' | 'csv' | null>(null)
  async function run(kind: 'json' | 'csv') {
    setBusy(kind)
    try {
      const rows = await fetchAllForExport()
      const date = new Date().toISOString().slice(0, 10)
      if (kind === 'json') downloadFile(`recall-export-${date}.json`, toJson(rows), 'application/json')
      else downloadFile(`recall-export-${date}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
      toast.success(`Exported ${rows.length} ${rows.length === 1 ? 'save' : 'saves'}`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => void run('json')} loading={busy === 'json'} disabled={!!busy}>
        <Download className="h-4 w-4" aria-hidden /> Export JSON
      </Button>
      <Button variant="outline" onClick={() => void run('csv')} loading={busy === 'csv'} disabled={!!busy}>
        <Download className="h-4 w-4" aria-hidden /> Export CSV
      </Button>
    </div>
  )
}

function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function confirm() {
    setBusy(true)
    try {
      await deleteAccount()
      await signOut()
      navigate('/', { replace: true })
      toast.success('Your account and all your saves were deleted.')
    } catch (error) {
      toast.error(errorMessage(error))
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="outline" className="border-danger/40 text-danger hover:bg-danger-soft" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)} title="Delete your account?" description="All saves, notes, tags and collections are permanently deleted. This cannot be undone.">
        <Label htmlFor="confirm-delete">
          Type <strong>DELETE</strong> to confirm
        </Label>
        <Input id="confirm-delete" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" disabled={typed !== 'DELETE'} loading={busy} onClick={() => void confirm()}>
            Delete everything
          </Button>
        </div>
      </Dialog>
    </>
  )
}

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { data: profile, isPending } = useProfile()
  const { preference, setPreference } = useTheme()
  const navigate = useNavigate()
  const email = user?.email ?? ''

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />
      <div className="space-y-4">
        <Card title="Account">
          {isPending ? <Skeleton className="h-64" /> : <AccountForm key={profile?.updated_at ?? 'none'} profile={profile ?? null} email={email} />}
        </Card>

        <Card title="Appearance">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={preference === value}
                onClick={() => setPreference(value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm transition-colors',
                  preference === value ? 'border-accent bg-accent-soft text-accent-soft-fg' : 'border-line hover:bg-surface-2',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </Card>

        <Card title="AI" description="AI processing helps summarize and organize your saved content.">
          <p className="flex items-start gap-2 text-sm text-muted">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            After you save something, Recall reads its public preview and writes a short summary, a category and a few tags. It only
            uses what’s publicly available, never invents details, and your content is never used to train AI models.
          </p>
        </Card>

        <Card title="Privacy" description="Your saves are private to you. Take them with you any time.">
          <ExportButtons />
          <div className="mt-6 border-t border-line pt-5">
            <p className="mb-3 text-sm text-muted">Permanently delete your account and everything in it.</p>
            <DeleteAccount />
          </div>
        </Card>

        <Button
          variant="ghost"
          className="w-full"
          onClick={async () => {
            await signOut()
            navigate('/', { replace: true })
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden /> Log out
        </Button>
      </div>
    </div>
  )
}
