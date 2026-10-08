import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useProfile } from '@/features/settings/profileHooks'

/**
 * First visit after signup → the 3-screen onboarding. Never blocks the app:
 * while the profile loads (or if it fails to), the app renders normally.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { data: profile, isSuccess } = useProfile()
  if (isSuccess && profile && !profile.onboarded_at) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}
