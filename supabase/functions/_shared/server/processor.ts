// The background pipeline for one claimed job (spec §20, §43):
//
//   metadata → write preview → AI enrichment → write AI fields/tags → embedding
//
// Idempotent by construction: every write is a deterministic overwrite of
// server-owned fields (user-edited fields are skipped), tags go through
// apply_ai_tags, and the job itself was claimed atomically by start_processing.
// Failures never delete or hide the item — it ends up 'partial' and the job
// 'failed' (retryable by the worker / Reprocess button).
import { buildEmbeddingText } from '../ai/embedding-text.ts'
import { hasEnoughSource, isGenericTitle, SUMMARY_UNAVAILABLE } from '../ai/enrichment.ts'
import { cleanText } from '../text.ts'
import type { Source, SourceType } from '../url.ts'
import { AiUnavailableError, enrich, generateEmbedding, getAiProvider } from './ai/index.ts'
import type { SupabaseClient } from './deps.ts'
import { fetchMetadata } from './metadata.ts'

export interface Job {
  id: string
  saved_item_id: string
  user_id: string
  job_type: 'enrich' | 'embed'
  attempts: number
}

interface ItemRow {
  id: string
  user_id: string
  url: string
  source: Source
  source_type: SourceType
  title: string | null
  description: string | null
  author_name: string | null
  content_text: string | null
  ai_summary: string | null
  ai_category: string | null
  personal_note: string | null
  user_edited: string[]
  metadata: Record<string, unknown>
}

const SOURCE_LABELS: Record<Source, string> = {
  instagram: 'Instagram', youtube: 'YouTube', reddit: 'Reddit', x: 'X', facebook: 'Facebook', website: 'Website', other: 'Link',
}
const TYPE_LABELS: Record<SourceType, string> = {
  reel: 'Reel', post: 'Post', short: 'Short', video: 'Video', article: 'Article', product: 'Product', pdf: 'PDF', image: 'Image', link: 'Link',
}

function sourceLabel(source: Source, type: SourceType): string {
  return type === 'link' ? SOURCE_LABELS[source] : `${SOURCE_LABELS[source]} ${TYPE_LABELS[type]}`
}

const ITEM_FIELDS = 'id, user_id, url, source, source_type, title, description, author_name, content_text, ai_summary, ai_category, personal_note, user_edited, metadata'

async function loadItem(admin: SupabaseClient, job: Job): Promise<ItemRow | null> {
  const { data, error } = await admin
    .from('saved_items')
    .select(ITEM_FIELDS)
    .eq('id', job.saved_item_id)
    .eq('user_id', job.user_id) // service role bypasses RLS: scope explicitly
    .maybeSingle()
  if (error) throw new Error(`load item: ${error.message}`)
  return data as ItemRow | null
}

async function itemTagNames(admin: SupabaseClient, itemId: string): Promise<{ name: string; origin: string }[]> {
  const { data, error } = await admin.from('item_tags').select('origin, tags(name)').eq('item_id', itemId)
  if (error) throw new Error(`load tags: ${error.message}`)
  return ((data ?? []) as unknown as { origin: string; tags: { name: string } | null }[])
    .filter((r) => r.tags)
    .map((r) => ({ name: r.tags!.name, origin: r.origin }))
}

async function finish(admin: SupabaseClient, job: Job, ok: boolean, error?: string) {
  await admin.rpc('finish_processing', { p_job: job.id, p_ok: ok, p_error: error ?? null })
}

const edited = (item: ItemRow, field: string) => item.user_edited.includes(field)

export async function runEnrichJob(admin: SupabaseClient, job: Job): Promise<void> {
  const item = await loadItem(admin, job)
  if (!item) return finish(admin, job, true) // deleted meanwhile — nothing to do

  try {
    // ── 1. Metadata ─────────────────────────────────────────────────────────
    const meta = await fetchMetadata(item.url, item.source, item.source_type)
    const metaUpdate: Record<string, unknown> = {
      thumbnail_url: meta.image,
      author_name: meta.authorName,
      author_url: meta.authorUrl,
      content_text: meta.contentText,
      source_type: meta.sourceType,
      metadata: {
        ...item.metadata,
        site_name: meta.siteName,
        og_type: meta.ogType,
        page_canonical: meta.pageCanonical,
        fetch_status: meta.status,
        fetched_via: meta.via,
        fetch_notes: meta.notes.slice(0, 5),
        fetched_at: new Date().toISOString(),
      },
    }
    if (!edited(item, 'title')) metaUpdate.title = meta.title
    if (!edited(item, 'description')) metaUpdate.description = meta.description

    // Write the preview now so the user sees it while AI runs.
    const { error: metaError } = await admin.from('saved_items').update(metaUpdate).eq('id', item.id).eq('user_id', item.user_id)
    if (metaError) throw new Error(`write metadata: ${metaError.message}`)

    const title = edited(item, 'title') ? item.title : meta.title
    const description = edited(item, 'description') ? item.description : meta.description

    // ── 2. AI enrichment ────────────────────────────────────────────────────
    const provider = getAiProvider()
    let aiOk = false
    let aiError: string | null = null
    if (provider) {
      const tags = await itemTagNames(admin, item.id)
      const input = {
        url: item.url,
        sourceLabel: sourceLabel(item.source, meta.sourceType),
        title: isGenericTitle(title) ? null : title,
        description,
        author: meta.authorName,
        contentText: meta.contentText,
        personalNote: item.personal_note,
        existingTags: tags.filter((t) => t.origin === 'user').map((t) => t.name),
      }
      try {
        const result = await enrich(provider, input)
        const aiUpdate: Record<string, unknown> = {
          ai_summary: hasEnoughSource(input) ? result.summary : SUMMARY_UNAVAILABLE,
        }
        if (!edited(item, 'ai_category')) aiUpdate.ai_category = result.category
        if (!edited(item, 'title') && !title && result.title) aiUpdate.title = result.title
        const { error } = await admin.from('saved_items').update(aiUpdate).eq('id', item.id).eq('user_id', item.user_id)
        if (error) throw new Error(`write ai: ${error.message}`)
        const { error: tagError } = await admin.rpc('apply_ai_tags', { p_item: item.id, p_names: result.tags })
        if (tagError) throw new Error(`apply tags: ${tagError.message}`)
        aiOk = true
      } catch (error) {
        aiError = error instanceof AiUnavailableError ? 'AI processing will be retried later.' : cleanText((error as Error).message, 300)
        console.error('enrichment failed', item.id, (error as Error).message)
      }
    } else {
      aiError = 'AI is not configured.'
    }

    // ── 3. Status ───────────────────────────────────────────────────────────
    const status = aiOk && meta.status !== 'unavailable' ? 'ready' : 'partial'
    await admin
      .from('saved_items')
      .update({ processing_status: status, processing_error: aiOk ? null : aiError })
      .eq('id', item.id)
      .eq('user_id', item.user_id)

    // ── 4. Embedding (best effort; has its own retry path) ───────────────────
    await embedItem(admin, item.id, item.user_id).catch((e) => console.error('embed failed', item.id, (e as Error).message))

    // A missing AI key isn't a transient failure; don't keep retrying it.
    const retryableAiFailure = !aiOk && provider !== null
    await finish(admin, job, !retryableAiFailure, retryableAiFailure ? aiError ?? 'AI failed' : undefined)
  } catch (error) {
    const message = cleanText((error as Error).message, 900) ?? 'Processing failed'
    console.error('enrich job failed', job.id, message)
    await admin
      .from('saved_items')
      .update({ processing_status: 'partial', processing_error: 'We saved the link, but couldn’t finish processing it.' })
      .eq('id', job.saved_item_id)
      .eq('user_id', job.user_id)
    await finish(admin, job, false, message)
  }
}

/** (Re)build the item's embedding from its current text. */
export async function embedItem(admin: SupabaseClient, itemId: string, userId: string): Promise<void> {
  const { data, error } = await admin
    .from('saved_items')
    .select('title, description, ai_summary, ai_category, personal_note, author_name, content_text, source, source_type, updated_at')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`load for embed: ${error.message}`)
  if (!data) return
  const row = data as Omit<ItemRow, 'id' | 'user_id' | 'url' | 'user_edited' | 'metadata'> & { updated_at: string }
  const tags = await itemTagNames(admin, itemId)
  const text = buildEmbeddingText({ ...row, sourceLabel: sourceLabel(row.source, row.source_type), tags: tags.map((t) => t.name) })
  const vector = await generateEmbedding(text)
  // Guard against a concurrent edit: only write if the row hasn't changed since we read it.
  const { error: writeError } = await admin
    .from('saved_items')
    .update({ embedding: JSON.stringify(vector), embedded_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('user_id', userId)
    .eq('updated_at', row.updated_at)
  if (writeError) throw new Error(`write embedding: ${writeError.message}`)
}

export async function runEmbedJob(admin: SupabaseClient, job: Job): Promise<void> {
  try {
    await embedItem(admin, job.saved_item_id, job.user_id)
    await finish(admin, job, true)
  } catch (error) {
    await finish(admin, job, false, cleanText((error as Error).message, 900) ?? 'Embedding failed')
  }
}

export function runJob(admin: SupabaseClient, job: Job): Promise<void> {
  return job.job_type === 'embed' ? runEmbedJob(admin, job) : runEnrichJob(admin, job)
}
