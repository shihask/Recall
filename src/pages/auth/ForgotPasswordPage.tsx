import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { FieldError, Input, Label } from '@/components/ui/Input'
import { friendlyAuthError } from '@/features/auth/errors'
import { AuthLayout } from '@/layouts/AuthLayout'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (err) setError(friendlyAuthError(err))
    else setSent(true)
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={sent ? 'If an account exists for that email, a reset link is on its way.' : 'We’ll email you a link to choose a new one.'}
      footer={<Link to="/login" className="font-medium text-fg hover:underline">Back to log in</Link>}
    >
      {!sent && (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <FieldError id="reset-error">{error}</FieldError>
          </div>
          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
