// deno test supabase/functions/_shared/server/ai/groq_test.ts
import { assert, assertEquals, assertRejects } from '@std/assert'
import { enrich } from './index.ts'
import { GroqProvider } from './groq.ts'
import { AiUnavailableError } from './provider.ts'

const input = {
  url: 'https://www.youtube.com/watch?v=abc',
  sourceLabel: 'YouTube Video',
  title: 'How to clean a motorcycle helmet visor',
  description: 'Quick guide to cleaning a helmet visor without scratches using microfiber.',
  author: 'MotoCare',
  contentText: null,
  personalNote: 'For my XPulse helmet',
  existingTags: [],
}

function stubFetch(response: Response, capture?: (body: Record<string, unknown>) => void) {
  const original = globalThis.fetch
  globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) => {
    capture?.(JSON.parse(String(init?.body)))
    return Promise.resolve(response)
  }) as typeof fetch
  return () => (globalThis.fetch = original)
}

Deno.test('sends a JSON-mode, low-reasoning request and validates the answer', async () => {
  let sent: Record<string, unknown> = {}
  const restore = stubFetch(
    Response.json({
      choices: [{ message: { content: JSON.stringify({ title: null, summary: 'How to clean a helmet visor with microfiber.', category: 'motorcycles', tags: ['Helmet Care', 'Visor', 'youtube'] }) } }],
    }),
    (b) => (sent = b),
  )
  try {
    const result = await enrich(new GroqProvider('test-key'), input)
    assertEquals(sent.model, 'openai/gpt-oss-20b')
    assertEquals(sent.reasoning_effort, 'low')
    assertEquals((sent.response_format as { type: string }).type, 'json_object')
    assertEquals(result.category, 'Motorcycles')
    assertEquals(result.tags, ['Helmet Care', 'Visor'])
  } finally {
    restore()
  }
})

Deno.test('rate limits are retryable, bad keys are not', async () => {
  let restore = stubFetch(new Response('slow down', { status: 429 }))
  try {
    const e = await assertRejects(() => new GroqProvider('k').complete('s', 'u'), AiUnavailableError)
    assert(e.retryable)
  } finally {
    restore()
  }
  restore = stubFetch(new Response('bad key', { status: 401 }))
  try {
    const e = await assertRejects(() => new GroqProvider('k').complete('s', 'u'), AiUnavailableError)
    assertEquals(e.retryable, false)
  } finally {
    restore()
  }
})

Deno.test('empty completions are errors, not blank summaries', async () => {
  const restore = stubFetch(Response.json({ choices: [{ message: { content: '' } }] }))
  try {
    await assertRejects(() => new GroqProvider('k').complete('s', 'u'), AiUnavailableError)
  } finally {
    restore()
  }
})
