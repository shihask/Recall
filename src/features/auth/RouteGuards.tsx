import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullPageSpinner } from '@/components/ui/misc'
import { useAuth } from './auth-context'

/** Signed-in users (guests included) only; everyone else goes to /login and comes back after. */
export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (!user) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}

/**
 * Landing / login / signup: signed-in users skip straight into the app.
 * Guests may still open login and signup — that's how they upgrade.
 */
export function PublicOnlyRoute() {
  const { user, isGuest, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (user && (!isGuest || location.pathname === '/')) return <Navigate to="/home" replace />
  return <Outlet />
}
