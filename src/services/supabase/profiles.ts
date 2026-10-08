import { supabase } from '@/lib/supabase'
import type { ProfileRow } from '@/types/database'
import { AppError, toAppError } from './errors'

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw toAppError(error)
  return data
}

export type ProfilePatch = Partial<Pick<ProfileRow, 'display_name' | 'avatar_url' | 'onboarded_at'>>

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<void> {
  if (patch.avatar_url && !/^https:\/\//i.test(patch.avatar_url)) throw new AppError('invalid', 'Avatar must be an https:// image link.')
  // Upsert covers accounts created before the profile trigger existed.
  const { error } = await supabase.from('profiles').upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
  if (error) throw toAppError(error)
}

/** Permanently delete the account and every row it owns (server-side, service role). */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } })
  if (error) throw new AppError('unknown', 'We couldn’t delete your account. Please try again.', { cause: error })
}
