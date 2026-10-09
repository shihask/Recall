// POST /functions/v1/media-download   { item_id }
//
// "Save to gallery" for an Instagram save: finds the post's video (or image)
// file on Instagram's public embed page and returns its CDN URL. The browser
// downloads it directly (the CDN allows cross-origin reads), so no media
// passes through this function.
//
// Like the unofficial previews, this reads Instagram outside its official API
// and terms, so it's behind the same operator switch
// (UNOFFICIAL_SOCIAL_PREVIEWS=true). The app also hides the button unless the
// user turned it on in Settings.
import { instagramEmbedUrl, parseInstagramEmbedMedia } from '../_shared/metadata-parse.ts'
import { adminClient, getCaller } from '../_shared/server/clients.ts'
import { json, preflight, readJson, UUID_RE } from '../_shared/server/http.ts'
import { env } from '../_shared/server/runtime.ts'
import { safeFetch } from '../_shared/server/safe-fetch.ts'

// The embed page only includes the media URL for a plain browser-like client.
const EMBED_UA = 'Mozilla/5.0'

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early

  const user = await getCaller(req)
  if (!user) return json(req, 401, { error: 'unauthorized' })
  if (env('UNOFFICIAL_SOCIAL_PREVIEWS') !== 'true') return json(req, 403, { error: 'disabled' })

  const body = await readJson(req)
  const itemId = body?.item_id
  if (typeof itemId !== 'string' || !UUID_RE.test(itemId)) return json(req, 400, { error: 'invalid_request' })

  // Ownership: the service role bypasses RLS, so check explicitly.
  const { data: item, error } = await adminClient()
    .from('saved_items')
    .select('url, source')
    .eq('id', itemId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return json(req, 500, { error: 'lookup_failed' })
  if (!item) return json(req, 404, { error: 'not_found' })

  const post = item.source === 'instagram' ? instagramEmbedUrl(item.url) : null
  if (!post) return json(req, 422, { error: 'unsupported' })

  try {
    const res = await safeFetch(post.embedUrl, {
      accept: 'text/html',
      maxBytes: 2_000_000,
      timeoutMs: 10_000,
      bodyIf: (ct) => /text\/html/i.test(ct),
      userAgent: EMBED_UA,
    })
    const media = res.status === 200 && res.body ? parseInstagramEmbedMedia(res.body) : null
    if (media?.videoUrl) return json(req, 200, { kind: 'video', url: media.videoUrl, filename: `instagram-${post.code}.mp4` })
    if (media?.imageUrl) return json(req, 200, { kind: 'image', url: media.imageUrl, filename: `instagram-${post.code}.jpg` })
    return json(req, 404, { error: 'no_media' })
  } catch (e) {
    console.error('media-download failed', itemId, (e as Error).message)
    return json(req, 502, { error: 'fetch_failed' })
  }
})
