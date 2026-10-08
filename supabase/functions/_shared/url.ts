// URL validation, platform detection and canonicalization.
//
// Runtime-agnostic on purpose: imported by the browser (via the `@shared`
// alias) AND by Edge Functions (relative import). It must not import anything
// or touch DOM/Deno globals — only the WHATWG URL API, which both provide.
//
// `canonical_url` is computed ONLY here, deterministically from the URL the
// user pasted. Duplicate detection runs in the browser before any metadata is
// fetched, so a page's own <link rel="canonical"> must never overwrite it —
// that would make the next client-side check miss. The page canonical is kept
// in metadata.page_canonical instead.

export const SOURCES = ['instagram', 'youtube', 'reddit', 'x', 'facebook', 'website', 'other'] as const
export type Source = (typeof SOURCES)[number]

export const SOURCE_TYPES = ['reel', 'post', 'short', 'video', 'article', 'product', 'pdf', 'image', 'link'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export const MAX_URL_LENGTH = 2048

export type ParsedUrl =
  | { ok: true; url: URL }
  | { ok: false; error: string }

export const INVALID_URL_MESSAGE = 'Please enter a valid URL.'

/**
 * Parse what a user pasted. Accepts bare domains ("youtube.com/watch?v=…")
 * by assuming https. Rejects non-web schemes (javascript:, data:, file:),
 * embedded credentials, and hosts that are not public-looking domain names.
 */
export function parseUserUrl(input: string): ParsedUrl {
  const raw = input.trim()
  if (!raw) return { ok: false, error: INVALID_URL_MESSAGE }
  if (raw.length > MAX_URL_LENGTH) return { ok: false, error: 'That link is too long.' }
  if (/\s/.test(raw)) return { ok: false, error: INVALID_URL_MESSAGE }

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw)
  // "example.com:8080/x" looks like a scheme to the regex; treat host:port as schemeless.
  const looksLikeHostPort = /^[^/:]+\.[^/:]+:\d+/.test(raw)
  const candidate = hasScheme && !looksLikeHostPort ? raw : `https://${raw.replace(/^\/\//, '')}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, error: INVALID_URL_MESSAGE }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, error: INVALID_URL_MESSAGE }
  if (url.username || url.password) return { ok: false, error: INVALID_URL_MESSAGE }

  const host = url.hostname.toLowerCase()
  // Require a dotted hostname with an alphabetic TLD: rules out "localhost",
  // bare words, and IP literals (not something people save from the internet).
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,63}$/.test(host)) return { ok: false, error: INVALID_URL_MESSAGE }

  return { ok: true, url }
}

/** Host without www./m./mobile. etc., lowercased. */
export function bareHost(url: URL): string {
  return url.hostname.toLowerCase().replace(/^(www|m|mobile|old|new|mbasic|web|touch)\./, '')
}

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'instagr.am'])
const YOUTUBE_HOSTS = new Set(['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'music.youtube.com'])
const REDDIT_HOSTS = new Set(['reddit.com', 'redd.it'])
const X_HOSTS = new Set(['x.com', 'twitter.com'])
const FACEBOOK_HOSTS = new Set(['facebook.com', 'fb.com', 'fb.watch'])

export function detectSource(url: URL): Source {
  const host = bareHost(url)
  if (INSTAGRAM_HOSTS.has(host)) return 'instagram'
  if (YOUTUBE_HOSTS.has(host)) return 'youtube'
  if (REDDIT_HOSTS.has(host)) return 'reddit'
  if (X_HOSTS.has(host)) return 'x'
  if (FACEBOOK_HOSTS.has(host)) return 'facebook'
  return 'website'
}

const IG_MEDIA = /\/(reels?|p|tv)\/([A-Za-z0-9_-]+)/
const YT_ID = /^[A-Za-z0-9_-]{6,20}$/

function youtubeVideo(url: URL): { id: string; kind: 'video' | 'short' } | null {
  const host = bareHost(url)
  const parts = url.pathname.split('/').filter(Boolean)
  if (host === 'youtu.be') {
    const id = parts[0]
    return id && YT_ID.test(id) ? { id, kind: 'video' } : null
  }
  if (url.pathname === '/watch') {
    const id = url.searchParams.get('v')
    return id && YT_ID.test(id) ? { id, kind: 'video' } : null
  }
  const [first, id] = parts
  if (id && YT_ID.test(id)) {
    if (first === 'shorts') return { id, kind: 'short' }
    if (first === 'live' || first === 'embed' || first === 'v') return { id, kind: 'video' }
  }
  return null
}

function redditPost(url: URL): { sub: string | null; id: string } | null {
  const host = bareHost(url)
  const parts = url.pathname.split('/').filter(Boolean)
  if (host === 'redd.it') {
    const id = parts[0]
    return id && /^[a-z0-9]+$/i.test(id) ? { sub: null, id: id.toLowerCase() } : null
  }
  // /r/{sub}/comments/{id}/{slug?}  or  /comments/{id}
  const c = parts.indexOf('comments')
  const id = c >= 0 ? parts[c + 1] : undefined
  if (id && /^[a-z0-9]+$/i.test(id)) {
    const sub = parts[0] === 'r' && parts[1] ? parts[1] : null
    return { sub, id: id.toLowerCase() }
  }
  return null
}

function xStatusId(url: URL): string | null {
  // Early X ids are short (status/20 is real), so don't impose a minimum length.
  const m = url.pathname.match(/\/status(?:es)?\/(\d{1,25})(?:\/|$)/)
  return m?.[1] ?? null
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|heic)$/i

export function detectSourceType(url: URL, source: Source = detectSource(url)): SourceType {
  const path = url.pathname
  switch (source) {
    case 'instagram': {
      const m = path.match(IG_MEDIA)
      if (!m) return 'link'
      if (m[1] === 'reel' || m[1] === 'reels') return 'reel'
      if (m[1] === 'tv') return 'video'
      return 'post'
    }
    case 'youtube': {
      const v = youtubeVideo(url)
      return v ? v.kind : 'link'
    }
    case 'reddit': {
      if (redditPost(url) || /^\/r\/[^/]+\/s\/[^/]+/.test(path)) return 'post'
      return 'link'
    }
    case 'x':
      return xStatusId(url) ? 'post' : 'link'
    case 'facebook': {
      if (bareHost(url) === 'fb.watch') return 'video'
      if (/^\/(reel|share\/r)\//.test(path)) return 'reel'
      if (/^\/(watch|share\/v)\b/.test(path) || /\/videos\//.test(path)) return 'video'
      if (/\/photos?\b|^\/photo\.php/.test(path)) return 'image'
      if (/\/posts\/|^\/permalink\.php|^\/story\.php|^\/share\/p\//.test(path)) return 'post'
      return 'link'
    }
    default: {
      if (/\.pdf$/i.test(path)) return 'pdf'
      if (IMAGE_EXT.test(path)) return 'image'
      return 'link'
    }
  }
}

// Parameters that never change what a page *is*. Removed for canonical form.
const GLOBAL_TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid', 'twclid', 'ttclid', 'li_fat_id',
  'igsh', 'igshid', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi', 'mkt_tok', 'ref_src', 'ref_url',
  'share_id', 'rdt', 'spm', 'scid', 'cmpid', 'campaign_id',
])
const PLATFORM_TRACKING_PARAMS: Partial<Record<Source, Set<string>>> = {
  // Video links canonicalize to ?v=ID earlier; these only apply to other pages
  // (channels, playlists), where `list` IS the identity and must survive.
  youtube: new Set(['si', 'feature', 'pp', 'ab_channel', 'app']),
  x: new Set(['s', 't', 'ref', 'lang']),
  instagram: new Set(['utm_source', 'img_index', 'hl']),
  reddit: new Set(['share_id', 'context', 'ref', 'ref_source', 'rdt', '$deep_link', 'correlation_id', 'post_fullname']),
  facebook: new Set(['mibextid', 'rdid', 'sfnsn', 'ref', 'paipv', 'eav', '__tn__', '__cft__[0]', 'notif_id', 'notif_t', 's']),
}

function isTrackingParam(key: string, source: Source): boolean {
  const k = key.toLowerCase()
  return k.startsWith('utm_') || GLOBAL_TRACKING_PARAMS.has(k) || (PLATFORM_TRACKING_PARAMS[source]?.has(k) ?? false)
}

/**
 * Deterministic canonical form used for duplicate detection.
 * Not a "real" canonical — just stable for equivalent share links.
 */
export function canonicalizeUrl(url: URL, source: Source = detectSource(url)): string {
  switch (source) {
    case 'instagram': {
      const m = url.pathname.match(IG_MEDIA)
      if (m?.[2]) {
        const kind = m[1] === 'reels' ? 'reel' : m[1]
        return `https://www.instagram.com/${kind}/${m[2]}/`
      }
      break
    }
    case 'youtube': {
      const v = youtubeVideo(url)
      if (v) return `https://www.youtube.com/watch?v=${v.id}`
      break
    }
    case 'reddit': {
      const p = redditPost(url)
      if (p) return p.sub ? `https://www.reddit.com/r/${p.sub.toLowerCase()}/comments/${p.id}/` : `https://www.reddit.com/comments/${p.id}/`
      break
    }
    case 'x': {
      const id = xStatusId(url)
      if (id) return `https://x.com/i/status/${id}`
      break
    }
    default:
      break
  }
  return genericCanonical(url, source)
}

function genericCanonical(url: URL, source: Source): string {
  let host = bareHost(url)
  if (host === 'twitter.com') host = 'x.com'
  if (host === 'fb.com') host = 'facebook.com'

  const kept: [string, string][] = []
  url.searchParams.forEach((value, key) => {
    if (!isTrackingParam(key, source)) kept.push([key, value])
  })
  kept.sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)))
  const query = kept.length ? `?${new URLSearchParams(kept).toString()}` : ''

  let path = url.pathname.replace(/\/{2,}/g, '/')
  if (path.length > 1) path = path.replace(/\/+$/, '')
  if (path === '/') path = ''

  const port = url.port && url.port !== '443' && url.port !== '80' ? `:${url.port}` : ''
  // Hash-bang routes identify content in some SPAs; ordinary fragments don't.
  const hash = url.hash.startsWith('#!') ? url.hash : ''
  return `https://${host}${port}${path}${query}${hash}`
}

export interface AnalyzedUrl {
  url: string
  canonicalUrl: string
  source: Source
  sourceType: SourceType
}

/** Validate + analyze a pasted link in one go. */
export function analyzeUrl(input: string): { ok: true; value: AnalyzedUrl } | { ok: false; error: string } {
  const parsed = parseUserUrl(input)
  if (!parsed.ok) return parsed
  const source = detectSource(parsed.url)
  return {
    ok: true,
    value: {
      url: parsed.url.toString(),
      canonicalUrl: canonicalizeUrl(parsed.url, source),
      source,
      sourceType: detectSourceType(parsed.url, source),
    },
  }
}

/**
 * Pull the first link out of shared text, e.g. Android share sheets that send
 * "Check out this reel! https://www.instagram.com/reel/abc/?igsh=…".
 */
export function extractUrlFromText(text: string | null | undefined): string | null {
  if (!text) return null
  const m = text.match(/https?:\/\/[^\s<>"']+/i) ?? text.match(/\bwww\.[^\s<>"']+\.[^\s<>"']+/i)
  if (!m) return null
  // Trailing punctuation from prose ("…see https://x.com/a/status/1).") isn't part of the URL.
  let candidate = m[0].replace(/[.,!?;:'"\]]+$/, '')
  // Drop an unbalanced closing paren: "(see https://a.com/x)" → "https://a.com/x"
  while (candidate.endsWith(')') && (candidate.match(/\(/g)?.length ?? 0) < (candidate.match(/\)/g)?.length ?? 0)) {
    candidate = candidate.slice(0, -1)
  }
  return candidate
}

/** Human-friendly host for display ("youtube.com"). */
export function displayHost(urlString: string): string {
  try {
    return bareHost(new URL(urlString))
  } catch {
    return urlString
  }
}
