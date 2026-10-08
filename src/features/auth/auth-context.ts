import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  /** True until the initial session has been restored from storage. */
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** For components that only render inside protected routes. */
export function useUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('useUser called outside an authenticated route')
  return user
}
