// HTML → metadata, without a DOM (runs on Deno and in Node tests).
// Order of preference: OpenGraph → Twitter cards → standard HTML meta →
// JSON-LD (author). All output is cleaned plain text / validated URLs.
import { cleanLine, cleanText, stripTags } from './text.ts'

export interface PageMetadata {
  title: string | null
  description: string | null
  image: string | null
  authorName: string | null
  authorUrl: string | null
  siteName: string | null
  canonical: string | null
  ogType: string | null
  contentText: string | null
}

export const LIMITS = { title: 300, description: 2000, author: 200, content: 8000 } as const

/** Parse attributes of a single tag's inner text: `name="x" content='y'`. */
function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tag))) {
    const key = m[1]?.toLowerCase()
    if (key) attrs[key] = m[2] ?? m[3] ?? m[4] ?? ''
  }
  return attrs
}

function absoluteHttpUrl(value: string | null | undefined, base: string): string | null {
  if (!value) return null
  try {
    const u = new URL(value.trim(), base)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

function extractHead(html: string): string {
  const end = html.search(/<\/head\s*>/i)
  return end > 0 ? html.slice(0, end) : html.slice(0, 200_000)
}

function jsonLdAuthor(html: string): { name: string | null; url: string | null } {
  const blocks = html.match(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? []
  for (const block of blocks.slice(0, 10)) {
    const json = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '')
    try {
      const data: unknown = JSON.parse(json)
      const nodes = Array.isArray(data) ? data : [data, ...(((data as { '@graph'?: unknown[] })['@graph']) ?? [])]
      for (const node of nodes) {
        const author = (node as { author?: unknown })?.author
        const first = Array.isArray(author) ? author[0] : author
        if (typeof first === 'string') return { name: first, url: null }
        if (first && typeof first === 'object') {
          const a = first as { name?: unknown; url?: unknown }
          if (typeof a.name === 'string') return { name: a.name, url: typeof a.url === 'string' ? a.url : null }
        }
      }
    } catch {
      // Malformed JSON-LD is common; ignore.
    }
  }
  return { name: null, url: null }
}

function mainText(html: string): string | null {
  // Prefer the semantic content container; fall back to <body>.
  const pick =
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    null
  if (!pick) return null
  const withoutChrome = pick.replace(/<(nav|header|footer|aside|form|button|select)\b[\s\S]*?<\/\1\s*>/gi, ' ')
  return cleanText(stripTags(withoutChrome), LIMITS.content)
}

export function parseHtmlMetadata(html: string, pageUrl: string): PageMetadata {
  const head = extractHead(html)
  const meta = new Map<string, string>()
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const a = parseAttributes(tag.slice(5, -1))
    const key = (a.property ?? a.name ?? a.itemprop ?? '').toLowerCase()
    const content = a.content
    // First occurrence wins (og:image may repeat).
    if (key && content && !meta.has(key)) meta.set(key, content)
  }

  let canonical: string | null = null
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const a = parseAttributes(tag.slice(5, -1))
    if ((a.rel ?? '').toLowerCase().split(/\s+/).includes('canonical') && a.href) {
      canonical = absoluteHttpUrl(a.href, pageUrl)
      break
    }
  }

  const titleTag = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null
  const ld = jsonLdAuthor(html)
  const first = (...keys: string[]) => keys.map((k) => meta.get(k)).find((v) => v && v.trim()) ?? null

  const authorRaw = first('author', 'article:author', 'twitter:creator', 'og:article:author') ?? ld.name
  // article:author is sometimes a profile URL rather than a name.
  const authorIsUrl = !!authorRaw && /^https?:\/\//i.test(authorRaw)

  return {
    title: cleanLine(first('og:title', 'twitter:title') ?? titleTag, LIMITS.title),
    description: cleanText(first('og:description', 'twitter:description', 'description'), LIMITS.description),
    image: absoluteHttpUrl(first('og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'), pageUrl),
    authorName: authorIsUrl ? null : cleanLine(authorRaw, LIMITS.author),
    authorUrl: absoluteHttpUrl(authorIsUrl ? authorRaw : ld.url, pageUrl),
    siteName: cleanLine(first('og:site_name', 'application-name'), 120),
    canonical: canonical ?? absoluteHttpUrl(first('og:url'), pageUrl),
    ogType: cleanLine(first('og:type'), 60)?.toLowerCase() ?? null,
    contentText: mainText(html),
  }
}

/** Map og:type to our source_type for generic websites. */
export function sourceTypeFromOg(ogType: string | null): 'article' | 'product' | 'video' | null {
  if (!ogType) return null
  if (ogType.startsWith('article') || ogType === 'blog' || ogType === 'news') return 'article'
  if (ogType.startsWith('product') || ogType === 'og:product') return 'product'
  if (ogType.startsWith('video')) return 'video'
  return null
}

/**
 * Caption and author from Meta's Instagram/Facebook oEmbed `html` (a
 * blockquote). Meta has dropped fields like `title`/`author_name` from the
 * JSON over time; the embed markup still carries the caption ("captioned"
 * embed) and an "A post shared by Name (@handle)" credit line.
 */
export function parseMetaEmbedHtml(html: string): { caption: string | null; authorName: string | null } {
  let caption: string | null = null
  let authorName: string | null = null
  for (const m of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = cleanText(stripTags(m[1] ?? ''), LIMITS.description)
    if (!text) continue
    const credit = text.match(/^A (?:post|video|reel|photo) shared by (.+?)(?:\s*\(@[\w.]+\))?(?:\s+on\b.*)?$/is)
    if (credit) authorName ??= cleanLine((credit[1] ?? '').replace(/^@/, ''), LIMITS.author)
    else caption ??= text
  }
  if (!authorName) {
    const credit = html.match(/>\s*A (?:post|video|reel|photo) shared by ([^<]+?)\s*</i)
    if (credit) authorName = cleanLine((credit[1] ?? '').replace(/\s*\(@[\w.]+\)$/, '').replace(/^@/, ''), LIMITS.author)
  }
  return { caption, authorName }
}
