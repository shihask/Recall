import type { Enrichment, EnrichmentInput } from '../../ai/enrichment.ts'

/**
 * Any LLM provider Recall can use for enrichment. Implementations return the
 * raw model text; validation/sanitizing is provider-agnostic (validateEnrichment).
 */
export interface AiProvider {
  readonly name: string
  complete(system: string, user: string): Promise<string>
}

export class AiUnavailableError extends Error {
  readonly retryable: boolean
  constructor(message: string, retryable = true) {
    super(message)
    this.retryable = retryable
  }
}

export type { Enrichment, EnrichmentInput }
