import { describe, expect, it } from 'vitest'
import { detectBrowser, detectPlatform, isSnoozed, readSnoozed, SNOOZE_MS } from './install'

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 389.0.0.49.87',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.0.0 Mobile Safari/537.36',
  androidFacebook:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 [FBAN/EMA;FBLC/en_US;FBAV/400.0.0.0;]',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
}

describe('install platform detection', () => {
  it('detects phones and ignores desktops', () => {
    expect(detectPlatform({ userAgent: UA.iphoneSafari })).toBe('ios')
    expect(detectPlatform({ userAgent: UA.androidChrome })).toBe('android')
    expect(detectPlatform({ userAgent: UA.windowsChrome, platform: 'Win32' })).toBeNull()
  })

  it('treats an iPad in desktop mode as iOS, but not a real Mac', () => {
    expect(detectPlatform({ userAgent: UA.ipadDesktopMode, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios')
    expect(detectPlatform({ userAgent: UA.ipadDesktopMode, platform: 'MacIntel', maxTouchPoints: 0 })).toBeNull()
  })

  it('picks the right directions for each browser', () => {
    expect(detectBrowser({ userAgent: UA.iphoneSafari })).toBe('safari')
    expect(detectBrowser({ userAgent: UA.iphoneChrome })).toBe('ios-other')
    expect(detectBrowser({ userAgent: UA.androidChrome })).toBe('chrome')
    expect(detectBrowser({ userAgent: UA.androidSamsung })).toBe('samsung')
    expect(detectBrowser({ userAgent: UA.androidFirefox })).toBe('firefox')
    expect(detectBrowser({ userAgent: UA.windowsChrome })).toBeNull()
  })

  it('spots in-app browsers, which cannot install', () => {
    expect(detectBrowser({ userAgent: UA.iphoneInstagram })).toBe('in-app')
    expect(detectBrowser({ userAgent: UA.androidFacebook })).toBe('in-app')
    expect(detectBrowser({ userAgent: UA.androidWebView })).toBe('in-app')
  })
})

describe('install banner snooze', () => {
  const now = 1_800_000_000_000

  it('stays hidden for 14 days after "Not now"', () => {
    expect(isSnoozed(null, now)).toBe(false)
    expect(isSnoozed(String(now - 1000), now)).toBe(true)
    expect(isSnoozed(String(now - SNOOZE_MS - 1), now)).toBe(false)
    expect(isSnoozed('garbage', now)).toBe(false)
  })

  it('survives storage that throws', () => {
    const throwing = { getItem: () => { throw new Error('blocked') } }
    expect(readSnoozed(throwing, now)).toBe(false)
  })
})
