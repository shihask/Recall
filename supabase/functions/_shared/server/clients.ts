import { createClient, type SupabaseClient, type User } from './deps.ts'
import { requireEnv } from './runtime.ts'

/**
 * Service-role client. Bypasses RLS, so every query through it must scope by
 * the verified user id explicitly. The key comes from Edge secrets only and is
 * never returned to callers.
 */
export function adminClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Client acting as the caller (RLS applies), for user-scoped reads/RPCs. */
export function userClient(req: Request): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Verify the caller's JWT with Supabase Auth. Null if missing/invalid/expired. */
export async function getCaller(req: Request): Promise<User | null> {
  const header = req.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null
  const { data, error } = await adminClient().auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
