/** Map Supabase Auth errors to calm, human copy. Never echo raw server text blindly. */
export function friendlyAuthError(error: unknown): string {
  const message = (error as { message?: string } | null)?.message?.toLowerCase() ?? ''
  const code = (error as { code?: string } | null)?.code ?? ''

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) return 'That email and password don’t match.'
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) return 'Please confirm your email first — check your inbox.'
  if (code === 'user_already_exists' || message.includes('already registered')) return 'An account with this email already exists. Try logging in.'
  if (code === 'weak_password' || message.includes('password should be')) return 'Please choose a stronger password (at least 8 characters).'
  if (code === 'over_email_send_rate_limit' || message.includes('rate limit')) return 'Too many attempts. Please wait a minute and try again.'
  if (message.includes('failed to fetch') || message.includes('network')) return 'Couldn’t connect. Please try again.'
  return 'Something went wrong. Please try again.'
}
