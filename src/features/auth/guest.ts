import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import { countSaves } from '@/services/supabase/items'
import { useAuth } from './auth-context'

/**
 * Guest mode: "Try without an account" is a Supabase anonymous sign-in, a
 * real private account with no email. Guests get GUEST_SAVE_LIMIT saves; when
 * they sign up or log in, the claim-guest function moves their saves over.
 */

// Mirrors public.guest_save_limit() in the guest_mode migration — change both together.
export const GUEST_SAVE_LIMIT = 5

// The guest session's latest refresh token. It's the proof of "these guest
// saves are mine" that claim-guest needs once a real account takes over the
// session. Supabase rotates it on every refresh, so it's rewritten each time.
const GUEST_TOKEN_KEY = 'recall:guest-refresh-token'

export function rememberGuestToken(token: string): void {
  try {
    localStorage.setItem(GUEST_TOKEN_KEY, token)
  } catch {
    // Blocked storage: the guest's saves just can't follow them into an account.
  }
}

function readGuestToken(): string | null {
  try {
    return localStorage.getItem(GUEST_TOKEN_KEY)
  } catch {
    return null
  }
}

export function forgetGuestToken(): void {
  try {
    localStorage.removeItem(GUEST_TOKEN_KEY)
  } catch {
    // Nothing to forget.
  }
}

export async function startGuestSession(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInAnonymously()
  if (!error) return { error: null }
  const msg = error.message.toLowerCase()
  if (msg.includes('disabled')) return { error: 'Guest mode isn’t available right now. Please sign up instead.' }
  if (error.status === 429 || msg.includes('rate limit')) return { error: 'Too many guest sessions from your network. Please sign up instead.' }
  return { error: 'Couldn’t start a guest session. Please try again.' }
}

let claiming: Promise<number> | null = null

/**
 * If this browser was a guest before the current (full) account signed in,
 * move the guest's saves into it. Returns how many moved. Safe to call often:
 * it does nothing without a remembered guest, and never runs twice at once.
 */
export function claimGuestSaves(): Promise<number> {
  claiming ??= (async () => {
    const token = readGuestToken()
    if (!token) return 0
    const { data, error } = await supabase.functions.invoke<{ moved: number }>('claim-guest', { body: { guest_refresh_token: token } })
    if (!error) {
      forgetGuestToken()
      return data?.moved ?? 0
    }
    const body = (await (error as { context?: Response } | null)?.context?.json().catch(() => null)) as
      | { error?: string; guest_refresh_token?: string }
      | null
    if (body?.guest_refresh_token) rememberGuestToken(body.guest_refresh_token) // Rotated: retry with the new one.
    else if (body?.error === 'guest_gone' || body?.error === 'not_guest') forgetGuestToken() // Nothing to claim, ever.
    // Anything else (offline, server error): keep the token and try again next sign-in.
    return 0
  })().finally(() => {
    claiming = null
  })
  return claiming
}

/** A guest's save allowance. For full accounts `atLimit` is always false. */
export function useGuestSaves() {
  const { isGuest } = useAuth()
  const { data: used = 0 } = useQuery({ queryKey: qk.saveCount(), queryFn: countSaves, enabled: isGuest })
  return { isGuest, used, left: Math.max(0, GUEST_SAVE_LIMIT - used), atLimit: isGuest && used >= GUEST_SAVE_LIMIT }
}
