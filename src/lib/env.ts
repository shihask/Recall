// Only browser-safe values. Secrets (AI keys, service role) live exclusively in
// Edge Function secrets and must never be read here.
//
// Validated by hand rather than with zod so the schema library stays out of the
// entry chunk (it's only needed by forms, which are lazy-loaded).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export const isSupabaseConfigured = isHttpUrl(url) && typeof anonKey === 'string' && anonKey.length >= 20

export const env = isSupabaseConfigured
  ? { VITE_SUPABASE_URL: url as string, VITE_SUPABASE_ANON_KEY: anonKey as string }
  : // Placeholders keep the client constructible so the app can render a
    // "not configured" screen instead of crashing on import.
    { VITE_SUPABASE_URL: 'https://placeholder.supabase.co', VITE_SUPABASE_ANON_KEY: 'placeholder-anon-key-000000' }
