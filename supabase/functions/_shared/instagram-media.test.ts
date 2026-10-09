import { describe, expect, it } from 'vitest'
import { instagramEmbedUrl, parseInstagramEmbedMedia } from './metadata-parse.ts'

// Shaped like Instagram's embed page: JSON, escaped again inside a JS string.
const embed = String.raw`<script>s.handle({"gql_data":"{\"shortcode_media\":{\"display_url\":\"https:\\\/\\\/instagram.fblr4-3.fna.fbcdn.net\\\/v\\\/t51\\\/img.jpg?stp=a\\u0026oh=1\",\"video_url\":\"https:\\\/\\\/instagram.fblr4-4.fna.fbcdn.net\\\/o1\\\/v\\\/clip.mp4?_nc_cat=104&oh=00_X\",\"is_video\":true}}"})</script>`

describe('Instagram embed media', () => {
  it('extracts and unescapes the video and image URLs', () => {
    expect(parseInstagramEmbedMedia(embed)).toEqual({
      videoUrl: 'https://instagram.fblr4-4.fna.fbcdn.net/o1/v/clip.mp4?_nc_cat=104&oh=00_X',
      imageUrl: 'https://instagram.fblr4-3.fna.fbcdn.net/v/t51/img.jpg?stp=a&oh=1',
    })
  })
  it('only accepts Instagram/Facebook CDN hosts', () => {
    const evil = embed.replace('instagram.fblr4-4.fna.fbcdn.net', 'evil.example.com')
    expect(parseInstagramEmbedMedia(evil).videoUrl).toBeNull()
  })
  it('returns nulls for pages without media', () => {
    expect(parseInstagramEmbedMedia('<html>Log in</html>')).toEqual({ videoUrl: null, imageUrl: null })
  })
  it('builds the embed URL for posts and reels', () => {
    expect(instagramEmbedUrl('https://www.instagram.com/reel/DeQaUQKT4vw/?psln=x')).toEqual({
      embedUrl: 'https://www.instagram.com/reel/DeQaUQKT4vw/embed/',
      code: 'DeQaUQKT4vw',
    })
    expect(instagramEmbedUrl('https://www.instagram.com/reels/AbCdE123/')?.embedUrl).toBe('https://www.instagram.com/reel/AbCdE123/embed/')
    expect(instagramEmbedUrl('https://www.instagram.com/p/AbCdE123/')?.embedUrl).toBe('https://www.instagram.com/p/AbCdE123/embed/')
    expect(instagramEmbedUrl('https://www.instagram.com/someone/')).toBeNull()
  })
})
