import { AiUnavailableError, type AiProvider } from './provider.ts'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Named, not inlined: Groq retires models with little notice; switching is an
// AI_MODEL secret change (or this one line). gpt-oss models are reasoning
// models — keep reasoning effort low and leave enough completion budget, or a
// tight max_tokens yields an empty answer instead of an error.
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b'

export class GroqProvider implements AiProvider {
  readonly name = 'groq'
  private readonly apiKey: string
  private readonly model: string

  constructor(apiKey: string, model = DEFAULT_GROQ_MODEL) {
    this.apiKey = apiKey
    this.model = model
  }

  async complete(system: string, user: string): Promise<string> {
    let res: Response
    try {
      res = await fetch(GROQ_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          max_completion_tokens: 1200,
          reasoning_effort: 'low',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      })
    } catch (error) {
      throw new AiUnavailableError(`AI request failed: ${(error as Error).message}`)
    }

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200)
      // 4xx other than rate limits means our request/key is wrong — retrying won't help.
      const retryable = res.status === 429 || res.status >= 500
      throw new AiUnavailableError(`AI provider returned ${res.status}: ${detail}`, retryable)
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] }
    const content = data.choices?.[0]?.message?.content
    if (!content || !content.trim()) throw new AiUnavailableError('AI returned an empty response')
    return content
  }
}
