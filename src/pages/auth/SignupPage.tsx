import { MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FieldError, Input, Label } from '@/components/ui/Input'
import { friendlyAuthError } from '@/features/auth/errors'
import { GoogleButton, OrDivider } from '@/features/auth/GoogleButton'
import { AuthLayout } from '@/layouts/AuthLayout'
import { supabase } from '@/lib/supabase'
import { safeNextPath } from '@/utils/navigation'

const schema = z.object({
  name: z.string().trim().max(80, 'Please keep your name under 80 characters.'),
  email: z.email('Please enter a valid email.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(72, 'Passwords are limited to 72 characters.'),
})

type Errors = Partial<Record<'name' | 'email' | 'password' | 'form', string>>

export default function SignupPage() {
  const [params] = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = schema.safeParse({ ...form, email: form.email.trim() })
    if (!parsed.success) {
      const fieldErrors: Errors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors
        fieldErrors[key] ??= issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: parsed.data.name || null },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/onboarding')}`,
      },
    })
    setLoading(false)
    if (error) {
      setErrors({ form: friendlyAuthError(error) })
      return
    }
    // With email confirmation on, there is no session until the link is clicked.
    if (data.session) navigate('/onboarding', { replace: true })
    else setSentTo(parsed.data.email)
  }

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" subtitle={`We sent a confirmation link to ${sentTo}.`}>
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-fg">
            <MailCheck className="h-7 w-7" aria-hidden />
          </div>
          <p className="text-sm text-muted">Open it on this device to start remembering.</p>
          <Link to="/login" className="text-sm font-medium hover:underline">
            Back to log in
          </Link>
        </div>
      </AuthLayout>
    )
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <AuthLayout
      title="Start remembering"
      subtitle="Save now. Find it when you need it."
      footer={
        <>
          Already have an account?{' '}
          <Link to={`/login${params.toString() ? `?${params}` : ''}`} className="font-medium text-fg underline-offset-2 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <GoogleButton next={next === '/home' ? '/onboarding' : next} />
      <OrDivider />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="name" hint="Optional">
            Name
          </Label>
          <Input id="name" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} aria-describedby="name-error" />
          <FieldError id="name-error">{errors.name}</FieldError>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} aria-describedby="email-error" />
          <FieldError id="email-error">{errors.email}</FieldError>
        </div>
        <div>
          <Label htmlFor="password" hint="8+ characters">
            Password
          </Label>
          <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} aria-invalid={!!errors.password} aria-describedby="password-error" />
          <FieldError id="password-error">{errors.password}</FieldError>
        </div>
        <FieldError id="form-error">{errors.form}</FieldError>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create account
        </Button>
        <p className="text-center text-xs text-subtle">Your saves are private to you.</p>
      </form>
    </AuthLayout>
  )
}
