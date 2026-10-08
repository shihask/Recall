import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FullPageSpinner } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/auth-context'
import { AuthLayout } from '@/layouts/AuthLayout'
import { safeNextPath } from '@/utils/navigation'

/**
 * Landing point for OAuth and email-confirmation redirects. The Supabase
 * client (detectSessionInUrl + PKCE) exchanges the code itself; we just wait
 * for the session to appear, then continue.
 */
export default function AuthCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [timedOut, setTimedOut] = useState(false)
  const errorDescription = params.get('error_description')
  const next = safeNextPath(params.get('next'))

  useEffect(() => {
    if (user) navigate(next, { replace: true })
  }, [user, next, navigate])

  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 10_000)
    return () => window.clearTimeout(t)
  }, [])

  if (errorDescription || (timedOut && !loading && !user)) {
    return (
      <AuthLayout title="We couldn’t sign you in" subtitle="The link may have expired or already been used.">
        <div className="text-center">
          <Link to="/login" className="text-sm font-medium hover:underline">
            Back to log in
          </Link>
        </div>
      </AuthLayout>
    )
  }
  return <FullPageSpinner />
}
