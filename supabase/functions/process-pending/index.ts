// POST /functions/v1/process-pending   (retry worker — NOT called by browsers)
//
// Safety net for saves whose immediate processing call never arrived or
// failed: retries pending/failed jobs (max 3 attempts) and backfills missing
// embeddings. Normal saves never depend on this.
//
// Auth: deployed with verify_jwt = false and protected by a dedicated shared
// secret in the `x-cron-secret` header (CRON_SECRET Edge secret). The
// service-role key is used only inside this function and never leaves it.
import { adminClient } from '../_shared/server/clients.ts'
import { json, preflight, timingSafeEqual } from '../_shared/server/http.ts'
import { embedItem, runJob, type Job } from '../_shared/server/processor.ts'
import { env } from '../_shared/server/runtime.ts'

const BATCH = 10
const EMBED_BACKFILL = 20

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early

  const secret = env('CRON_SECRET')
  const given = req.headers.get('x-cron-secret') ?? ''
  if (!secret || secret.length < 24 || !timingSafeEqual(given, secret)) return json(req, 401, { error: 'unauthorized' })

  const admin = adminClient()
  const results = { claimed: 0, completed: 0, embedded: 0, errors: 0 }

  // Leave very fresh jobs to the immediate call that's probably in flight.
  const settled = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const recent = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: candidates, error } = await admin
    .from('processing_jobs')
    .select('saved_item_id, job_type')
    .in('status', ['pending', 'failed'])
    .lt('attempts', 3)
    .lt('created_at', settled)
    .gt('created_at', recent)
    .order('created_at', { ascending: true })
    .limit(BATCH)
  if (error) return json(req, 500, { error: 'query_failed' })

  for (const c of candidates ?? []) {
    const { data: job } = await admin.rpc('start_processing', { p_item: c.saved_item_id, p_type: c.job_type, p_force: false })
    const claimed = job as Job | null
    if (!claimed?.id) continue
    results.claimed++
    try {
      await runJob(admin, claimed)
      results.completed++
    } catch {
      results.errors++
    }
  }

  // Items whose text changed (or never got embedded).
  const { data: stale } = await admin
    .from('saved_items')
    .select('id, user_id')
    .is('embedded_at', null)
    .in('processing_status', ['ready', 'partial'])
    .lt('updated_at', settled)
    .limit(EMBED_BACKFILL)
  for (const item of stale ?? []) {
    try {
      await embedItem(admin, item.id, item.user_id)
      results.embedded++
    } catch {
      results.errors++
    }
  }

  return json(req, 200, results)
})
