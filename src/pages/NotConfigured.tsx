/** Shown when VITE_SUPABASE_* are missing, instead of a blank crash. */
export function NotConfigured() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-line bg-surface p-6 shadow-soft">
        <h1 className="text-lg font-semibold">Recall isn’t configured yet</h1>
        <p className="mt-2 text-sm text-muted">
          Set <code className="rounded bg-surface-2 px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-surface-2 px-1">VITE_SUPABASE_ANON_KEY</code> (see <code>.env.example</code>), then restart.
        </p>
      </div>
    </div>
  )
}
