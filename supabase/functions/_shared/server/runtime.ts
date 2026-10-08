// Typed access to Supabase Edge Runtime globals, with safe fallbacks so the
// same code type-checks with plain `deno check` and runs under `supabase serve`.

interface EmbeddingSession {
  run(input: string, options: { mean_pool: boolean; normalize: boolean }): Promise<unknown>
}

interface SupabaseAiGlobal {
  ai: { Session: new (model: string) => EmbeddingSession }
}

interface EdgeRuntimeGlobal {
  waitUntil(promise: Promise<unknown>): void
}

const g = globalThis as unknown as { EdgeRuntime?: EdgeRuntimeGlobal; Supabase?: SupabaseAiGlobal }

/**
 * Keep working after the response is sent (Supabase background tasks). Falls
 * back to awaiting inline where the runtime lacks it, which is slower for the
 * caller but still correct.
 */
export async function runInBackground(task: Promise<unknown>): Promise<void> {
  const safe = task.catch((error) => console.error('background task failed', error))
  if (g.EdgeRuntime?.waitUntil) g.EdgeRuntime.waitUntil(safe)
  else await safe
}

let session: EmbeddingSession | null = null

/** Supabase's built-in gte-small model (384 dims). Null where unavailable. */
export function embeddingSession(model: string): EmbeddingSession | null {
  if (!g.Supabase?.ai?.Session) return null
  session ??= new g.Supabase.ai.Session(model)
  return session
}

export function env(name: string): string | undefined {
  const v = Deno.env.get(name)
  return v && v.trim() ? v.trim() : undefined
}

export function requireEnv(name: string): string {
  const v = env(name)
  if (!v) throw new Error(`Missing required environment variable ${name}`)
  return v
}
