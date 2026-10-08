// Best-effort public metadata for a saved URL. NEVER throws: a save must
// survive any failure here (spec §19). Order:
//   1. Public oEmbed endpoints the platforms publish for exactly this purpose
//      (YouTube, X, Reddit) — no auth, no scraping.
//   2. The page's own OpenGraph/Twitter/HTML meta — only if robots.txt allows
//      our bot to fetch that path (RFC 9309). Login walls / blocks are
//      accepted as "metadata unavailable"; we never try to get around them.
import { isGenericTitle } from '../ai/enrichment.ts'
import { LIMITS, parseHtmlMetadata, sourceTypeFromOg, type PageMetadata } from '../metadata-parse.ts'
import { BOT_TOKEN, isAllowedByRobots } from '../robots.ts'
import { cleanLine, cleanText, stripTags } from '../text.ts'
import type { Source, SourceType } from '../url.ts'
import { env } from './runtime.ts'
import { FetchBlockedError, safeFetch } from './safe-fetch.ts'

// Graph API versions live ~2 years; bump when Meta deprecates this one.
const META_GRAPH_VERSION = 'v23.0'

export interface FetchedMetadata extends Omit<PageMetadata, 'canonical'> {
  pageCanonical: string | null
  sourceType: SourceType
  status: 'ok' | 'partial' | 'unavailable'
  via: string[]
  notes: string[]
}

const HTML_TIMEOUT = 8000
const HTML_MAX_BYTES = 1_500_000

function empty(sourceType: SourceType): FetchedMetadata {
  return {
    title: null, description: null, image: null, authorName: null, authorUrl: null, siteName: null,
    pageCanonical: null, ogType: null, contentText: null, sourceType, status: 'unavailable', via: [], notes: [],
  }
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const u = new URL(value)
    return (u.protocol === 'https:' || u.protocol === 'http:') && value.length <= 4096 ? u.toString() : null
  } catch {
    return null
  }
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  const res = await safeFetch(url, { accept: 'application/json', maxBytes: 256_000, timeoutMs: 6000 })
  if (res.status !== 200 || !res.body) return null
  const parsed: unknown = JSON.parse(res.body)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
}

// robots.txt per origin, cached for the life of the isolate.
const robotsCache = new Map<string, Promise<string | 'disallow-all' | null>>()

function robotsFor(origin: string): Promise<string | 'disallow-all' | null> {
  let cached = robotsCache.get(origin)
  if (!cached) {
    cached = (async () => {
      try {
        const res = await safeFetch(`${origin}/robots.txt`, { accept: 'text/plain', maxBytes: 500_000, timeoutMs: 4000 })
        if (res.status >= 400 && res.status < 500) return null // no robots.txt → allowed
        if (res.status >= 500) return 'disallow-all' // RFC 9309: unreachable → assume disallow
        return res.body ?? ''
      } catch (error) {
        // An unsafe/unresolvable host is a block, not a robots decision; surface it.
        if (error instanceof FetchBlockedError) throw error
        return 'disallow-all'
      }
    })()
    robotsCache.set(origin, cached)
  }
  return cached
}

async function allowedByRobots(url: URL): Promise<boolean> {
  const robots = await robotsFor(url.origin)
  if (robots === null) return true
  if (robots === 'disallow-all') return false
  return isAllowedByRobots(robots, `${url.pathname}${url.search}`, BOT_TOKEN)
}

async function oEmbed(source: Source, url: string): Promise<Partial<FetchedMetadata> | null> {
  const q = encodeURIComponent(url)
  switch (source) {
    case 'youtube': {
      const data = await fetchJson(`https://www.youtube.com/oembed?format=json&url=${q}`)
      if (!data) return null
      return {
        title: cleanLine(data.title as string, LIMITS.title),
        authorName: cleanLine(data.author_name as string, LIMITS.author),
        authorUrl: httpUrl(data.author_url),
        image: httpUrl(data.thumbnail_url),
        siteName: 'YouTube',
      }
    }
    case 'x': {
      const data = await fetchJson(`https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=${q}`)
      if (!data) return null
      const html = typeof data.html === 'string' ? data.html : ''
      // The embed's <p> holds the post text; the trailing "— Name (@handle) date" is chrome.
      const text = cleanText(stripTags(html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? ''), LIMITS.description)
      const author = cleanLine(data.author_name as string, LIMITS.author)
      return {
        title: author ? `${author} on X` : null,
        description: text,
        contentText: text,
        authorName: author,
        authorUrl: httpUrl(data.author_url),
        siteName: 'X',
      }
    }
    case 'instagram':
    case 'facebook': {
      // Meta's official oEmbed API — the only sanctioned way to get previews
      // for Instagram/Facebook posts. Needs a Meta app with the "oEmbed Read"
      // feature; token = "APP_ID|CLIENT_TOKEN". Off unless configured.
      const token = env('META_OEMBED_TOKEN')
      if (!token) return null
      const endpoint =
        source === 'instagram' ? 'instagram_oembed' : /\/(videos?|reel|watch)\b|fb\.watch/.test(url) ? 'oembed_video' : 'oembed_post'
      const data = await fetchJson(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${endpoint}?omitscript=true&url=${q}&access_token=${encodeURIComponent(token)}`,
      )
      if (!data) return null
      const author = cleanLine(data.author_name as string, LIMITS.author)
      // Instagram puts the post caption in `title` when it returns one.
      const caption = cleanText(data.title as string, LIMITS.description)
      return {
        title: caption ? cleanLine(caption, 120) : null,
        description: caption,
        contentText: caption,
        authorName: author,
        authorUrl: httpUrl(data.author_url),
        image: httpUrl(data.thumbnail_url),
        siteName: source === 'instagram' ? 'Instagram' : 'Facebook',
      }
    }
    case 'reddit': {
      const data = await fetchJson(`https://www.reddit.com/oembed?url=${q}`)
      if (!data) return null
      return {
        title: cleanLine(data.title as string, LIMITS.title),
        authorName: cleanLine(data.author_name as string, LIMITS.author),
        siteName: 'Reddit',
      }
    }
    default:
      return null
  }
}

async function fromHtml(url: URL, notes: string[]): Promise<{ meta: PageMetadata; contentType: string } | null> {
  if (!(await allowedByRobots(url))) {
    notes.push('robots.txt disallows fetching this page')
    return null
  }
  const res = await safeFetch(url.toString(), {
    accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
    maxBytes: HTML_MAX_BYTES,
    timeoutMs: HTML_TIMEOUT,
    bodyIf: (ct) => /text\/html|application\/xhtml\+xml/i.test(ct),
  })
  if (res.status !== 200) {
    notes.push(`page returned HTTP ${res.status}`)
    return null
  }
  if (!res.body) return { meta: { ...parseHtmlMetadata('', res.url) }, contentType: res.contentType }
  return { meta: parseHtmlMetadata(res.body, res.url), contentType: res.contentType }
}

/** Merge: first non-empty value wins, in the order given. */
function pick<T>(...values: (T | null | undefined)[]): T | null {
  for (const v of values) if (v !== null && v !== undefined && v !== '') return v
  return null
}

export async function fetchMetadata(rawUrl: string, source: Source, sourceType: SourceType): Promise<FetchedMetadata> {
  const out = empty(sourceType)
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    out.notes.push('invalid url')
    return out
  }

  let embed: Partial<FetchedMetadata> | null = null
  try {
    embed = await oEmbed(source, rawUrl)
    if (embed) out.via.push('oembed')
  } catch (error) {
    out.notes.push(`oembed failed: ${(error as Error).message}`.slice(0, 200))
  }

  // Reddit's and X's oEmbed already carry what we can legitimately get; their
  // pages are crawler-restricted, so don't bother.
  let page: PageMetadata | null = null
  if (source !== 'x' && source !== 'reddit' && sourceType !== 'image') {
    try {
      const html = await fromHtml(url, out.notes)
      if (html) {
        page = html.meta
        out.via.push('html')
        if (/application\/pdf/i.test(html.contentType)) out.sourceType = 'pdf'
      }
    } catch (error) {
      out.notes.push(error instanceof FetchBlockedError ? `blocked: ${error.message}` : `fetch failed: ${(error as Error).message}`.slice(0, 200))
    }
  }

  // Login walls dress up as metadata ("Instagram", "Log in • Instagram"): drop it.
  if (page && isGenericTitle(page.title)) {
    out.notes.push('page looks like a login wall or error page')
    page = { ...page, title: null, description: isGenericTitle(page.description) ? null : page.description }
  }

  out.title = pick(embed?.title, page?.title)
  out.description = pick(embed?.description, page?.description)
  out.image = pick(embed?.image, page?.image)
  out.authorName = pick(embed?.authorName, page?.authorName)
  out.authorUrl = pick(embed?.authorUrl, page?.authorUrl)
  out.siteName = pick(embed?.siteName, page?.siteName)
  out.contentText = pick(embed?.contentText, page?.contentText)
  out.pageCanonical = page?.canonical ?? null
  out.ogType = page?.ogType ?? null

  if (sourceType === 'image') out.image = url.toString()
  if (source === 'website' && out.sourceType === 'link') out.sourceType = sourceTypeFromOg(out.ogType) ?? 'link'

  const hasCore = !!out.title && (!!out.description || !!out.image || !!out.contentText)
  out.status = hasCore ? 'ok' : out.title || out.description || out.image ? 'partial' : 'unavailable'
  return out
}
