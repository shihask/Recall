import { describe, expect, it } from 'vitest'
import { parseHtmlMetadata, parseMetaEmbedHtml, sourceTypeFromOg } from './metadata-parse.ts'
import { isForbiddenHostname, isPrivateAddress } from './net.ts'
import { isAllowedByRobots } from './robots.ts'
import { cleanLine, cleanText, decodeEntities, stripTags } from './text.ts'

describe('text sanitizing', () => {
  it('decodes entities and drops control/invalid code points', () => {
    expect(decodeEntities('Tom &amp; Jerry &#8217;s &#x1F3CD; &bogus; &#0;')).toBe('Tom & Jerry ’s 🏍 &bogus; ')
  })
  it('strips scripts, styles and tags', () => {
    expect(stripTags('<p>Hi<script>alert(1)</script><style>x{}</style> <b>there</b></p>').replace(/\s+/g, ' ').trim()).toBe('Hi there')
  })
  it('caps length on word boundaries', () => {
    expect(cleanText('one two three four five six', 15)).toBe('one two three…')
    expect(cleanLine('  multi\n\nline   title ', 50)).toBe('multi line title')
    expect(cleanText('   ', 10)).toBeNull()
  })
})

const ogPage = `<!doctype html><html><head>
<title>Fallback title</title>
<meta property="og:title" content="3D Printed Motorcycle Phone Mount &amp; More">
<meta property="og:description" content='A DIY mount for your bike.'>
<meta property="og:image" content="/img/mount.jpg">
<meta property="og:image" content="/img/second.jpg">
<meta property="og:site_name" content="Maker Blog">
<meta property="og:type" content="article">
<meta name="author" content="Jane Maker">
<link rel="canonical" href="https://maker.example.com/mount">
<script type="application/ld+json">{"@type":"Article","author":{"name":"Ignored because meta wins","url":"https://maker.example.com/jane"}}</script>
</head><body><nav>Menu Home About</nav><article><h1>Mount</h1><p>Print it in PETG.</p><script>evil()</script></article><footer>(c)</footer></body></html>`

describe('parseHtmlMetadata', () => {
  it('prefers OpenGraph and resolves relative URLs', () => {
    const m = parseHtmlMetadata(ogPage, 'https://maker.example.com/posts/1')
    expect(m.title).toBe('3D Printed Motorcycle Phone Mount & More')
    expect(m.description).toBe('A DIY mount for your bike.')
    expect(m.image).toBe('https://maker.example.com/img/mount.jpg')
    expect(m.siteName).toBe('Maker Blog')
    expect(m.authorName).toBe('Jane Maker')
    expect(m.authorUrl).toBe('https://maker.example.com/jane')
    expect(m.canonical).toBe('https://maker.example.com/mount')
    expect(m.ogType).toBe('article')
    expect(m.contentText).toBe('Mount\nPrint it in PETG.')
  })

  it('falls back to twitter cards, then <title> and meta description', () => {
    const tw = parseHtmlMetadata(
      '<head><meta name="twitter:title" content="TW"><meta name="twitter:image" content="https://cdn.example.com/a.png"></head>',
      'https://a.com',
    )
    expect(tw.title).toBe('TW')
    expect(tw.image).toBe('https://cdn.example.com/a.png')
    const plain = parseHtmlMetadata('<head><title> Plain  page </title><meta name="description" content="Desc"></head>', 'https://a.com')
    expect(plain.title).toBe('Plain page')
    expect(plain.description).toBe('Desc')
  })

  it('reads JSON-LD authors and treats URL authors as links', () => {
    const ld = parseHtmlMetadata(
      '<head><script type="application/ld+json">[{"author":[{"name":"LD Person"}]}]</script></head>',
      'https://a.com',
    )
    expect(ld.authorName).toBe('LD Person')
    const url = parseHtmlMetadata('<head><meta property="article:author" content="https://a.com/u/x"></head>', 'https://a.com')
    expect(url.authorName).toBeNull()
    expect(url.authorUrl).toBe('https://a.com/u/x')
  })

  it('never returns script/data URLs or raw HTML', () => {
    const m = parseHtmlMetadata(
      '<head><meta property="og:image" content="javascript:alert(1)"><meta property="og:title" content="&lt;img src=x onerror=alert(1)&gt;"></head>',
      'https://a.com',
    )
    expect(m.image).toBeNull()
    expect(m.title).toBe('<img src=x onerror=alert(1)>') // plain text; React escapes on render
  })

  it('handles garbage gracefully', () => {
    const m = parseHtmlMetadata('<<<>>> not html at all', 'https://a.com')
    expect(m.title).toBeNull()
    expect(m.image).toBeNull()
  })

  it('maps og:type', () => {
    expect(sourceTypeFromOg('article')).toBe('article')
    expect(sourceTypeFromOg('product.item')).toBe('product')
    expect(sourceTypeFromOg('video.other')).toBe('video')
    expect(sourceTypeFromOg('website')).toBeNull()
  })
})

describe('SSRF guards', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:10.0.0.1', '999.1.1.1'])(
    'blocks %s',
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  )
  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '151.101.1.69'])('allows %s', (ip) => expect(isPrivateAddress(ip)).toBe(false))
  it('blocks internal hostnames', () => {
    for (const h of ['localhost', 'api.localhost', 'printer.local', 'metadata.google.internal', 'intranet']) expect(isForbiddenHostname(h)).toBe(true)
    expect(isForbiddenHostname('example.com')).toBe(false)
  })
})

describe('robots.txt', () => {
  const robots = `
User-agent: *
Disallow: /private
Allow: /private/public-page
Disallow: /*.pdf$

User-agent: RecallBot
User-agent: OtherBot
Disallow: /no-recall
`
  it('uses our group when present', () => {
    expect(isAllowedByRobots(robots, '/no-recall/x')).toBe(false)
    expect(isAllowedByRobots(robots, '/private')).toBe(true) // our group doesn't disallow it
  })
  it('falls back to * with longest-match and wildcards', () => {
    const star = 'User-agent: *\nDisallow: /private\nAllow: /private/public-page\nDisallow: /*.pdf$'
    expect(isAllowedByRobots(star, '/private/x')).toBe(false)
    expect(isAllowedByRobots(star, '/private/public-page')).toBe(true)
    expect(isAllowedByRobots(star, '/docs/a.pdf')).toBe(false)
    expect(isAllowedByRobots(star, '/docs/a.pdf?x=1')).toBe(true)
    expect(isAllowedByRobots(star, '/')).toBe(true)
  })
  it('handles disallow-all and empty files', () => {
    expect(isAllowedByRobots('User-agent: *\nDisallow: /', '/reel/abc/')).toBe(false)
    expect(isAllowedByRobots('', '/anything')).toBe(true)
    expect(isAllowedByRobots('User-agent: *\nDisallow:', '/anything')).toBe(true)
  })
})

describe('Meta oEmbed html', () => {
  it('reads caption and author from a captioned Instagram embed', () => {
    const html = `<blockquote class="instagram-media" data-instgrm-captioned data-instgrm-permalink="https://www.instagram.com/reel/abc/"><div style="padding:16px;"><a href="https://www.instagram.com/reel/abc/"><div>View this post on Instagram</div></a>
<p style=" margin:8px 0 0 0;"><a href="https://www.instagram.com/reel/abc/" target="_blank">Camping in Ponmudi &amp; the best sunrise spot 🏕️ #camping #kerala</a></p>
<p style=" color:#c9c8cd;"><a href="https://www.instagram.com/reel/abc/" target="_blank">A post shared by Shi Haz (@shihaz)</a> on <time datetime="2026-10-01">Oct 1, 2026</time></p></div></blockquote>`
    expect(parseMetaEmbedHtml(html)).toEqual({ caption: 'Camping in Ponmudi & the best sunrise spot 🏕️ #camping #kerala', authorName: 'Shi Haz' })
  })
  it('finds the credit line outside a <p> and tolerates no caption', () => {
    const html = `<blockquote><div><a href="x">A post shared by @travel.daily</a></div></blockquote>`
    expect(parseMetaEmbedHtml(html)).toEqual({ caption: null, authorName: 'travel.daily' })
    expect(parseMetaEmbedHtml('')).toEqual({ caption: null, authorName: null })
  })
})
