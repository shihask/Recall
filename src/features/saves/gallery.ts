// "Save to gallery" for Instagram saves (opt-in in Settings; the server also
// has to allow it). The server only finds the media URL; the browser downloads
// the file straight from Instagram's CDN.
import { supabase } from '@/lib/supabase'
import { AppError } from '@/services/supabase/errors'

const GALLERY_KEY = 'recall.gallery' // 'on' shows the button

export function isGalleryEnabled(): boolean {
  try {
    return localStorage.getItem(GALLERY_KEY) === 'on'
  } catch {
    return false
  }
}

export function setGalleryEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(GALLERY_KEY, 'on')
    else localStorage.removeItem(GALLERY_KEY)
  } catch {
    // Blocked storage: the setting just won't stick.
  }
}

// Which saves this device already downloaded ({ itemId: ISO date }). Per
// device on purpose: the gallery is per device, and the browser can't see it.
const DOWNLOADED_KEY = 'recall.gallery.downloaded'
const MAX_REMEMBERED = 500

function downloadedMap(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DOWNLOADED_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/** When this device saved the item to its gallery, or null. */
export function downloadedAt(itemId: string): string | null {
  return downloadedMap()[itemId] ?? null
}

export function markDownloaded(itemId: string) {
  // Newest last; drop the oldest beyond the cap so storage stays small.
  const entries = Object.entries(downloadedMap()).filter(([id]) => id !== itemId)
  entries.push([itemId, new Date().toISOString()])
  try {
    localStorage.setItem(DOWNLOADED_KEY, JSON.stringify(Object.fromEntries(entries.slice(-MAX_REMEMBERED))))
  } catch {
    // Blocked storage: it just won't remember.
  }
}

/** iPhone/iPad (incl. iPadOS reporting as a Mac): Photos is reached through the share sheet. */
export function isAppleMobile(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

const MESSAGES: Record<string, string> = {
  disabled: 'Saving to gallery is turned off on the server.',
  unsupported: 'Only Instagram posts and reels can be saved to the gallery.',
  no_media: 'Couldn’t find a video or photo for this post. It may be private or removed.',
  not_found: 'This save no longer exists.',
}

/** Ask the server where the media is, then download it into a File. */
export async function fetchMediaFile(itemId: string): Promise<File> {
  const { data, error } = await supabase.functions.invoke<{ kind: 'video' | 'image'; url: string; filename: string }>('media-download', {
    body: { item_id: itemId },
  })
  if (error || !data?.url) {
    let code = ''
    try {
      code = ((await (error as { context?: Response } | null)?.context?.json()) as { error?: string } | undefined)?.error ?? ''
    } catch {
      // Not a JSON error body.
    }
    throw new AppError('unknown', MESSAGES[code] ?? 'Couldn’t get the media. Please try again.')
  }
  const res = await fetch(data.url)
  if (!res.ok) throw new AppError('network', 'Instagram didn’t send the file. Please try again.')
  const blob = await res.blob()
  return new File([blob], data.filename, { type: blob.type || (data.kind === 'video' ? 'video/mp4' : 'image/jpeg') })
}

/** True when the share sheet can take this file (where "Save Video/Image" lives on iPhone). */
export function canShareFile(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

export async function shareFile(file: File): Promise<void> {
  await navigator.share({ files: [file] })
}

/** Regular download (Android/desktop: lands in Downloads, which the gallery shows). */
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
