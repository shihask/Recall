// The only module the rest of the backend imports for AI. Provider-specific
// code stays behind getAiProvider(); swapping providers is a change here.
import type { Category } from '../../categories.ts'
import { buildUserPrompt, SYSTEM_PROMPT, validateEnrichment, type Enrichment, type EnrichmentInput } from '../../ai/enrichment.ts'
import { embeddingSession, env } from '../runtime.ts'
import { GroqProvider } from './groq.ts'
import { AiUnavailableError, type AiProvider } from './provider.ts'

export { AiUnavailableError }

/** Null when AI isn't configured — callers degrade gracefully (item stays usable). */
export function getAiProvider(): AiProvider | null {
  const key = env('AI_API_KEY')
  if (!key) return null
  return new GroqProvider(key, env('AI_MODEL'))
}

/** One model call producing summary + category + tags (+ title when missing). */
export async function enrich(provider: AiProvider, input: EnrichmentInput): Promise<Enrichment> {
  const raw = await provider.complete(SYSTEM_PROMPT, buildUserPrompt(input))
  return validateEnrichment(raw, input)
}

// Spec §44 interface — thin views over the single enrichment call so callers
// that need one field don't pay for three requests.
export async function generateSummary(provider: AiProvider, input: EnrichmentInput): Promise<string> {
  return (await enrich(provider, input)).summary
}
export async function generateTags(provider: AiProvider, input: EnrichmentInput): Promise<string[]> {
  return (await enrich(provider, input)).tags
}
export async function generateCategory(provider: AiProvider, input: EnrichmentInput): Promise<Category> {
  return (await enrich(provider, input)).category
}

export const EMBEDDING_DIMENSIONS = 384

/**
 * Embed text with Supabase's built-in gte-small (no external API, no key).
 * Throws AiUnavailableError if the runtime lacks the model.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = env('EMBEDDING_MODEL') ?? 'gte-small'
  const session = embeddingSession(model)
  if (!session) throw new AiUnavailableError('Embedding model unavailable in this runtime')
  const output = await session.run(text.slice(0, 2000), { mean_pool: true, normalize: true })
  const vector = Array.isArray(output) ? output.map(Number) : []
  if (vector.length !== EMBEDDING_DIMENSIONS || vector.some((v) => !Number.isFinite(v))) {
    throw new AiUnavailableError(`Unexpected embedding shape (${vector.length})`)
  }
  return vector
}
