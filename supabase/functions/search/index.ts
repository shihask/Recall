// POST /functions/v1/search   { q, terms?, filters?, limit? }
//
// Hybrid recall: embeds the natural-language query with gte-small and asks
// Postgres to fuse vector similarity with keyword ranking. Runs the RPC with
// the CALLER's JWT, so RLS guarantees only their items can come back.
// 503 means "semantic unavailable" — the browser keeps its keyword results.
import { generateEmbedding } from '../_shared/server/ai/index.ts'
import { getCaller, userClient } from '../_shared/server/clients.ts'
import { json, preflight, readJson, UUID_RE } from '../_shared/server/http.ts'

const SOURCES = new Set(['instagram', 'youtube', 'reddit', 'x', 'facebook', 'website', 'other'])
const TYPES = new Set(['reel', 'post', 'short', 'video', 'article', 'product', 'pdf', 'image', 'link'])

/** Whitelist + validate filters; anything unexpected is dropped, never forwarded. */
function cleanFilters(raw: unknown): Record<string, unknown> {
  const f = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  const str = (v: unknown) => (typeof v === 'string' && v.length <= 64 ? v : null)
  const iso = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)
  if (str(f.source) && SOURCES.has(f.source as string)) out.source = f.source
  if (str(f.category)) out.category = f.category
  if (str(f.collection_id) && UUID_RE.test(f.collection_id as string)) out.collection_id = f.collection_id
  if (str(f.tag_id) && UUID_RE.test(f.tag_id as string)) out.tag_id = f.tag_id
  if (f.favorite === true) out.favorite = true
  if (f.include_archived === true) out.include_archived = true
  if (iso(f.from)) out.from = f.from
  if (iso(f.to)) out.to = f.to
  if (str(f.boost_source) && SOURCES.has(f.boost_source as string)) out.boost_source = f.boost_source
  if (str(f.boost_type) && TYPES.has(f.boost_type as string)) out.boost_type = f.boost_type
  return out
}

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early

  const user = await getCaller(req)
  if (!user) return json(req, 401, { error: 'unauthorized' })

  const body = await readJson(req)
  const q = typeof body?.q === 'string' ? body.q.trim().slice(0, 300) : ''
  const terms = typeof body?.terms === 'string' && body.terms.trim() ? body.terms.trim().slice(0, 300) : q
  const limit = typeof body?.limit === 'number' ? Math.min(Math.max(Math.floor(body.limit), 1), 50) : 30
  if (q.length < 2) return json(req, 400, { error: 'query_too_short' })

  let embedding: number[]
  try {
    embedding = await generateEmbedding(q)
  } catch (error) {
    console.error('query embedding failed', (error as Error).message)
    return json(req, 503, { error: 'semantic_unavailable' })
  }

  const { data, error } = await userClient(req).rpc('hybrid_search_items', {
    q: terms,
    query_embedding: JSON.stringify(embedding),
    filters: cleanFilters(body?.filters),
    lim: limit,
  })
  if (error) {
    console.error('hybrid search failed', error.message)
    return json(req, 503, { error: 'semantic_unavailable' })
  }
  return json(req, 200, { results: data ?? [] })
})
