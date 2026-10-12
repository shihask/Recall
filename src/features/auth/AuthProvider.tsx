import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { clearQueryCache } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { AuthContext } from './auth-context'
import { claimGuestSaves, forgetGuestToken, rememberGuestToken } from './guest'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    let mounted = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      // Never let one account's cached saves render for the next account.
      if (event === 'SIGNED_OUT') clearQueryCache()

      if (next?.user.is_anonymous) {
        rememberGuestToken(next.refresh_token)
      } else if (next && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        // A full account took over from a guest on this browser: bring the guest's saves along.
        // Deferred: Supabase calls made inside this callback can deadlock the auth client.
        setTimeout(() => {
          void claimGuestSaves().then((moved) => {
            if (!moved) return
            void queryClient.invalidateQueries()
            toast.success(moved === 1 ? 'Your guest save is now in your account.' : `Your ${moved} guest saves are now in your account.`)
          })
        }, 0)
      }
    })
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  const signOut = useCallback(async () => {
    // A guest who signs out can't get back in, so there's nothing left to claim.
    const { data } = await supabase.auth.getSession()
    if (data.session?.user.is_anonymous) forgetGuestToken()
    await supabase.auth.signOut()
    clearQueryCache()
  }, [])

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, isGuest: session?.user.is_anonymous === true, loading, signOut }),
    [session, loading, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
