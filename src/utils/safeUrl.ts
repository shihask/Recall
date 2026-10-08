/**
 * Only http(s) URLs ever reach an href or img src. Stored URLs are validated
 * on write too, but external metadata (thumbnails, author links) is untrusted,
 * so the render path checks again — defense in depth against javascript:/data:.
 */
export function safeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}
