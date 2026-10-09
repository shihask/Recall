// Recall's own copy of preview images whose platform links don't last.
//
// Instagram/Facebook CDN links are signed: they expire after a few days and
// are often only valid for the client that fetched the page (here, the Edge
// server — not the user's phone). So for those hosts we download the image
// once while processing and serve it from the public `thumbnails` bucket at
// `{user_id}/{item_id}`. Paths are two random UUIDs; the images are of public
// posts. Never throws — callers fall back to the original link.
import type { SupabaseClient } from './deps.ts'
import { safeFetch } from './safe-fetch.ts'

export const THUMBNAIL_BUCKET = 'thumbnails'

const MAX_BYTES = 5_000_000 // matches the bucket's file_size_limit
const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif)$/i

/** Hosts whose image links expire or are bound to the fetching client. */
export function needsMirroring(imageUrl: string): boolean {
  try {
    const host = new URL(imageUrl).hostname.toLowerCase()
    return host === 'cdninstagram.com' || host.endsWith('.cdninstagram.com') || host === 'fbcdn.net' || host.endsWith('.fbcdn.net')
  } catch {
    return false
  }
}

export const thumbnailPath = (userId: string, itemId: string) => `${userId}/${itemId}`

/** Copy the image into storage; returns its public URL, or null if anything fails. */
export async function mirrorThumbnail(admin: SupabaseClient, userId: string, itemId: string, imageUrl: string): Promise<string | null> {
  try {
    const res = await safeFetch(imageUrl, { accept: 'image/*', maxBytes: MAX_BYTES + 1, timeoutMs: 8000, bytes: true })
    const contentType = res.contentType.split(';')[0]?.trim() ?? ''
    if (res.status !== 200 || !res.bytes?.byteLength || !IMAGE_TYPES.test(contentType)) return null
    if (res.bytes.byteLength > MAX_BYTES) return null

    const path = thumbnailPath(userId, itemId)
    const bucket = admin.storage.from(THUMBNAIL_BUCKET)
    const { error } = await bucket.upload(path, res.bytes, { contentType, upsert: true, cacheControl: '604800' })
    if (error) throw new Error(error.message)
    // Same path on every refresh: version the URL so caches pick up the new image.
    return `${bucket.getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
  } catch (error) {
    console.error('mirror thumbnail failed', itemId, (error as Error).message)
    return null
  }
}

/** Remove every stored thumbnail of a user (account deletion). */
export async function deleteUserThumbnails(admin: SupabaseClient, userId: string): Promise<void> {
  const bucket = admin.storage.from(THUMBNAIL_BUCKET)
  for (;;) {
    const { data, error } = await bucket.list(userId, { limit: 1000 })
    if (error) throw new Error(error.message)
    if (!data?.length) return
    const { error: removeError } = await bucket.remove(data.map((f) => thumbnailPath(userId, f.name)))
    if (removeError) throw new Error(removeError.message)
    if (data.length < 1000) return
  }
}
