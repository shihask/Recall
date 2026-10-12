import { useSyncExternalStore } from 'react'

/**
 * "Install Recall" on phones. Android Chrome (and Edge/Samsung) fire
 * `beforeinstallprompt`, which we keep so a button can open the real install
 * dialog. iPhone never does: there it's always Share → Add to Home Screen, so
 * we show directions instead.
 */

export type InstallPlatform = 'ios' | 'android'
/** Which set of directions fits the browser the person is in. */
export type InstallBrowser = 'safari' | 'ios-other' | 'chrome' | 'samsung' | 'firefox' | 'in-app'

interface DeviceInfo {
  userAgent: string
  platform?: string
  maxTouchPoints?: number
}

const IN_APP_RE = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|TikTok|musical_ly|Snapchat|LinkedInApp|Pinterest/i

export function detectPlatform({ userAgent, platform, maxTouchPoints = 0 }: DeviceInfo): InstallPlatform | null {
  if (/iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  return null
}

export function detectBrowser(device: DeviceInfo): InstallBrowser | null {
  const os = detectPlatform(device)
  if (!os) return null
  const ua = device.userAgent
  if (IN_APP_RE.test(ua) || (os === 'android' && /; wv\)/.test(ua))) return 'in-app'
  if (os === 'ios') return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other' : 'safari'
  if (/SamsungBrowser/.test(ua)) return 'samsung'
  if (/Firefox/.test(ua)) return 'firefox'
  return 'chrome'
}

export function currentBrowser(): InstallBrowser | null {
  if (typeof navigator === 'undefined') return null
  return detectBrowser({ userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints })
}

/** Already running as the installed app. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

// ── Banner snooze ──────────────────────────────────────────────────────────
const DISMISSED_KEY = 'recall:install-dismissed-at'
export const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000

export function isSnoozed(dismissedAt: string | null, now: number): boolean {
  const at = Number(dismissedAt)
  return Number.isFinite(at) && at > 0 && now - at < SNOOZE_MS
}

export function readSnoozed(storage: Pick<Storage, 'getItem'> = localStorage, now = Date.now()): boolean {
  try {
    return isSnoozed(storage.getItem(DISMISSED_KEY), now)
  } catch {
    return false
  }
}

export function snoozeBanner(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
  } catch {
    // Blocked storage: the banner just comes back next visit.
  }
}

// ── Native install prompt (Android/desktop Chromium) ───────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

// Registered at import time: the event often fires before any banner mounts.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    notify()
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Whether the browser's own install dialog is available right now. */
export function useCanPromptInstall(): boolean {
  return useSyncExternalStore(subscribe, () => deferred !== null)
}

/** Whether Recall was installed during this visit. */
export function useJustInstalled(): boolean {
  return useSyncExternalStore(subscribe, () => installed)
}

/** Opens the browser's install dialog. Resolves true if the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred
  if (!event) return false
  deferred = null // A prompt event can only be used once.
  notify()
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome === 'accepted'
}
