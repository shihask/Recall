import { describe, expect, it } from 'vitest'
import { analyzeUrl, extractUrlFromText, parseUserUrl } from './url.ts'

function analyze(input: string) {
  const r = analyzeUrl(input)
  if (!r.ok) throw new Error(`expected valid: ${input} (${r.error})`)
  return r.value
}

describe('parseUserUrl', () => {
  it.each([
    'https://example.com',
    'http://example.com/a?b=c',
    'example.com/path',
    'www.youtube.com/watch?v=dQw4w9WgXcQ',
    '  https://instagram.com/reel/abc123/  ',
    'example.com:8080/x',
  ])('accepts %s', (input) => {
    expect(parseUserUrl(input).ok).toBe(true)
  })

  it.each([
    '',
    '   ',
    'not a url',
    'javascript:alert(1)',
    'data:text/html,<script>',
    'file:///etc/passwd',
    'ftp://example.com',
    'http://localhost:3000',
    'http://127.0.0.1/admin',
    'https://user:pass@example.com',
    'https://exa mple.com',
    `https://example.com/${'a'.repeat(2100)}`,
  ])('rejects %j', (input) => {
    expect(parseUserUrl(input).ok).toBe(false)
  })
})

describe('Instagram', () => {
  it('detects reels and canonicalizes share params away', () => {
    const v = analyze('https://www.instagram.com/reel/C1a2B3c4D5e/?igsh=MWQ1ZGUxMzBkMA==&utm_source=ig_web_copy_link')
    expect(v.source).toBe('instagram')
    expect(v.sourceType).toBe('reel')
    expect(v.canonicalUrl).toBe('https://www.instagram.com/reel/C1a2B3c4D5e/')
  })
  it('treats /reels/ID and /{user}/reel/ID as the same reel', () => {
    expect(analyze('instagram.com/reels/C1a2B3c4D5e').canonicalUrl).toBe('https://www.instagram.com/reel/C1a2B3c4D5e/')
    expect(analyze('https://instagram.com/someone/reel/C1a2B3c4D5e/').canonicalUrl).toBe('https://www.instagram.com/reel/C1a2B3c4D5e/')
  })
  it('detects posts and tv', () => {
    expect(analyze('https://instagram.com/p/Bxyz123/').sourceType).toBe('post')
    expect(analyze('https://m.instagram.com/tv/Bxyz123').sourceType).toBe('video')
  })
  it('profile pages are links', () => {
    expect(analyze('https://instagram.com/natgeo').sourceType).toBe('link')
  })
})

describe('YouTube', () => {
  const canonical = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&si=abc',
    'https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?si=xyz',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
  ])('canonicalizes %s', (input) => {
    const v = analyze(input)
    expect(v.source).toBe('youtube')
    expect(v.sourceType).toBe('video')
    expect(v.canonicalUrl).toBe(canonical)
  })
  it('detects shorts', () => {
    const v = analyze('https://youtube.com/shorts/dQw4w9WgXcQ?feature=share')
    expect(v.sourceType).toBe('short')
    expect(v.canonicalUrl).toBe(canonical)
  })
  it('keeps playlist identity', () => {
    const a = analyze('https://www.youtube.com/playlist?list=PL1&si=x').canonicalUrl
    const b = analyze('https://www.youtube.com/playlist?list=PL2').canonicalUrl
    expect(a).toBe('https://youtube.com/playlist?list=PL1')
    expect(a).not.toBe(b)
  })
})

describe('Reddit', () => {
  it('canonicalizes posts without slug or share params', () => {
    const v = analyze('https://old.reddit.com/r/3Dprinting/comments/1abcde/my_motorcycle_phone_mount/?share_id=xyz&utm_medium=android_app')
    expect(v.source).toBe('reddit')
    expect(v.sourceType).toBe('post')
    expect(v.canonicalUrl).toBe('https://www.reddit.com/r/3dprinting/comments/1abcde/')
  })
  it('handles redd.it and /s/ share links', () => {
    expect(analyze('https://redd.it/1abcde').canonicalUrl).toBe('https://www.reddit.com/comments/1abcde/')
    expect(analyze('https://www.reddit.com/r/bikes/s/AbCdEf').sourceType).toBe('post')
  })
  it('subreddits and users are links', () => {
    expect(analyze('https://reddit.com/r/motorcycles').sourceType).toBe('link')
    expect(analyze('https://www.reddit.com/user/someone').sourceType).toBe('link')
  })
})

describe('X / Twitter', () => {
  it('unifies twitter.com and x.com status links', () => {
    const a = analyze('https://twitter.com/SomeUser/status/1234567890123456789?s=20&t=abc')
    const b = analyze('https://x.com/someuser/status/1234567890123456789')
    expect(a.source).toBe('x')
    expect(a.sourceType).toBe('post')
    expect(a.canonicalUrl).toBe('https://x.com/i/status/1234567890123456789')
    expect(b.canonicalUrl).toBe(a.canonicalUrl)
  })
  it('accepts short historical ids and photo suffixes', () => {
    expect(analyze('https://twitter.com/jack/status/20').canonicalUrl).toBe('https://x.com/i/status/20')
    expect(analyze('https://x.com/a/status/123456789/photo/1').canonicalUrl).toBe('https://x.com/i/status/123456789')
  })
  it('profiles are links on x.com', () => {
    const v = analyze('https://mobile.twitter.com/someuser')
    expect(v.sourceType).toBe('link')
    expect(v.canonicalUrl).toBe('https://x.com/someuser')
  })
})

describe('Facebook', () => {
  it.each([
    ['https://www.facebook.com/reel/123456789', 'reel'],
    ['https://www.facebook.com/share/r/AbC123/', 'reel'],
    ['https://fb.watch/abcd/', 'video'],
    ['https://www.facebook.com/watch?v=123', 'video'],
    ['https://m.facebook.com/page/posts/pfbid0abc', 'post'],
    ['https://www.facebook.com/somepage', 'link'],
  ] as const)('%s → %s', (input, type) => {
    const v = analyze(input)
    expect(v.source).toBe('facebook')
    expect(v.sourceType).toBe(type)
  })
  it('keeps the watch video id but drops mibextid', () => {
    expect(analyze('https://www.facebook.com/watch?v=123&mibextid=abc').canonicalUrl).toBe('https://facebook.com/watch?v=123')
  })
})

describe('websites', () => {
  it('normalizes host, trailing slash, fragment, tracking and param order', () => {
    const a = analyze('https://WWW.Example.com/blog/post/?b=2&utm_source=x&a=1&fbclid=zzz#section')
    const b = analyze('http://example.com/blog/post?a=1&b=2')
    expect(a.source).toBe('website')
    expect(a.canonicalUrl).toBe('https://example.com/blog/post?a=1&b=2')
    expect(b.canonicalUrl).toBe(a.canonicalUrl)
  })
  it('keeps the original url for opening', () => {
    expect(analyze('http://example.com/x?utm_source=a').url).toBe('http://example.com/x?utm_source=a')
  })
  it('detects pdf and image', () => {
    expect(analyze('https://example.com/paper.PDF').sourceType).toBe('pdf')
    expect(analyze('https://example.com/a/photo.jpeg').sourceType).toBe('image')
    expect(analyze('https://example.com/a').sourceType).toBe('link')
  })
  it('does not strip meaningful params like s= on non-X sites', () => {
    expect(analyze('https://example.com/?s=helmet').canonicalUrl).toBe('https://example.com?s=helmet')
  })
})

describe('extractUrlFromText', () => {
  it.each([
    ['Check this out! https://www.instagram.com/reel/abc/?igsh=x', 'https://www.instagram.com/reel/abc/?igsh=x'],
    ['https://x.com/a/status/123.', 'https://x.com/a/status/123'],
    ['(see https://en.wikipedia.org/wiki/Foo_(bar)) ok', 'https://en.wikipedia.org/wiki/Foo_(bar)'],
    ['(see https://example.com/x)', 'https://example.com/x'],
    ['visit www.example.com/page today', 'www.example.com/page'],
  ])('%j', (text, expected) => {
    expect(extractUrlFromText(text)).toBe(expected)
  })
  it('returns null when no link', () => {
    expect(extractUrlFromText('no link here')).toBeNull()
    expect(extractUrlFromText(null)).toBeNull()
  })
})
