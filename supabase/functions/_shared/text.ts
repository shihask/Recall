// Plain-text sanitizing for untrusted external content. Everything Recall
// stores from the web is plain text (never rendered as HTML), capped in length.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', bull: '•',
  copy: '©', reg: '®', trade: '™', laquo: '«', raquo: '»', euro: '€', pound: '£',
}

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      // Drop control chars and invalid code points rather than emitting them.
      if (!Number.isFinite(code) || code < 32 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return ''
      return String.fromCodePoint(code)
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match
  })
}

export function stripTags(html: string): string {
  return html
    .replace(/<(script|style|noscript|template|svg|iframe)[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|section|article)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
}

/** Remove C0 control characters (except tab/newline/CR) and DEL. */
function stripControlChars(input: string): string {
  let out = ''
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) continue
    out += ch
  }
  return out
}

/** Collapse whitespace, drop control characters, trim, cap length (on a word boundary when possible). */
export function cleanText(input: string | null | undefined, max: number): string | null {
  if (!input) return null
  let text = stripControlChars(decodeEntities(input))
  text = text.replace(/[ \t\f\v\u00a0]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!text) return null
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.8 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…'
}

/** Single-line variant for titles/names. */
export function cleanLine(input: string | null | undefined, max: number): string | null {
  const text = cleanText(input, max * 2)
  return text ? cleanText(text.replace(/\s+/g, ' '), max) : null
}
