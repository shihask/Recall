import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { FieldError, Input, Label } from '@/components/ui/Input'
import { FullPageSpinner } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/auth-context'
import { friendlyAuthError } from '@/features/auth/errors'
import { AuthLayout } from '@/layouts/AuthLayout'
import { supabase } from '@/lib/supabase'

/** Reached from the recovery email; the link signs the user in first. */
export default function ResetPasswordPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (authLoading) return <FullPageSpinner />
  if (!user) {
    return (
      <AuthLayout title="Link expired" subtitle="Request a new password reset link.">
        <div className="text-center">
          <Link to="/forgot-password" className="text-sm font-medium hover:underline">
            Send a new link
          </Link>
        </div>
      </AuthLayout>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) {
      setError(friendlyAuthError(err))
      return
    }
    toast.success('Password updated')
    navigate('/home', { replace: true })
  }

  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="password" hint="8+ characters">
            New password
          </Label>
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error} />
          <FieldError id="pw-error">{error}</FieldError>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  )
}
