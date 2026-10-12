import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { FieldError, Input, Label } from '@/components/ui/Input'
import { friendlyAuthError } from '@/features/auth/errors'
import { useAuth } from '@/features/auth/auth-context'
import { GoogleButton, OrDivider } from '@/features/auth/GoogleButton'
import { TryAsGuestButton } from '@/features/auth/GuestPrompts'
import { AuthLayout } from '@/layouts/AuthLayout'
import { supabase } from '@/lib/supabase'
import { safeNextPath } from '@/utils/navigation'

export default function LoginPage() {
  const [params] = useSearchParams()
  const { isGuest } = useAuth()
  const next = safeNextPath(params.get('next'))
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (err) {
      setError(friendlyAuthError(err))
      return
    }
    navigate(next, { replace: true })
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={isGuest ? 'Log in and your guest saves come with you.' : 'Your memory is right where you left it.'}
      footer={
        <>
          New to Recall?{' '}
          <Link to={`/signup${params.toString() ? `?${params}` : ''}`} className="font-medium text-fg underline-offset-2 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton next={next} />
      <OrDivider />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? 'login-error' : undefined}
          />
          <FieldError id="login-error">{error}</FieldError>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email || !password}>
          Log in
        </Button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="text-muted hover:text-fg">
            Forgot your password?
          </Link>
        </p>
        {!isGuest && (
          <p className="text-center text-sm text-muted">
            Just looking? <TryAsGuestButton next={next} className="font-medium text-fg underline-offset-2 hover:underline" />
          </p>
        )}
      </form>
    </AuthLayout>
  )
}
