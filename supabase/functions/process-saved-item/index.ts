// POST /functions/v1/process-saved-item   { item_id, force?, job_type? }
//
// Called by the browser right after a save (fire-and-forget), after note/tag
// edits (job_type "embed") and by "Refresh details" (force). Verifies the
// caller owns the item, claims a job atomically, answers 202 immediately and
// does the slow work in the background.
import { adminClient, getCaller } from '../_shared/server/clients.ts'
import { json, preflight, readJson, UUID_RE } from '../_shared/server/http.ts'
import { runJob, type Job } from '../_shared/server/processor.ts'
import { runInBackground } from '../_shared/server/runtime.ts'

const MAX_JOBS_PER_HOUR = 150

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early

  const user = await getCaller(req)
  if (!user) return json(req, 401, { error: 'unauthorized' })

  const body = await readJson(req)
  const itemId = body?.item_id
  const jobType = body?.job_type ?? 'enrich'
  const force = body?.force === true
  if (typeof itemId !== 'string' || !UUID_RE.test(itemId) || (jobType !== 'enrich' && jobType !== 'embed')) {
    return json(req, 400, { error: 'invalid_request' })
  }

  const admin = adminClient()

  // Ownership: the service role bypasses RLS, so check explicitly.
  const { data: item, error: itemError } = await admin.from('saved_items').select('id').eq('id', itemId).eq('user_id', user.id).maybeSingle()
  if (itemError) return json(req, 500, { error: 'lookup_failed' })
  if (!item) return json(req, 404, { error: 'not_found' })

  // Basic abuse guard: each job may fetch external pages and call the AI.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await admin.from('processing_jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since)
  if ((count ?? 0) > MAX_JOBS_PER_HOUR) return json(req, 429, { error: 'rate_limited' })

  // Embeds are cheap and always reflect the latest text, so they're always (re)queued.
  const { data: job, error: jobError } = await admin.rpc('start_processing', {
    p_item: itemId,
    p_type: jobType,
    p_force: force || jobType === 'embed',
  })
  if (jobError) return json(req, 500, { error: 'queue_failed' })
  const claimed = job as Job | null
  if (!claimed?.id) return json(req, 202, { status: 'already_handled' })

  await runInBackground(runJob(admin, claimed))
  return json(req, 202, { status: 'processing', job_id: claimed.id })
})
