// "Copy a link anywhere, open Recall, it's ready to save."
//
// Browsers only allow reading the clipboard silently once the user has granted
// the `clipboard-read` permission (Chrome/Edge, incl. the installed Android
// app). Safari (iPhone/iPad) and Firefox never do: every read needs a tap, so
// there we offer "open Save when Recall opens" and the iOS Share-menu
// Shortcut instead. Nothing here ever prompts on its own.
import { extractUrlFromText } from '@shared/url.ts'
import { useEffect, useRef } from 'react'

const DETECT_KEY = 'recall.clipboard.detect' // 'off' disables auto-detect
const LAST_KEY = 'recall.clipboard.lastUrl'
const OPEN_ON_LAUNCH_KEY = 'recall.save.onOpen' // 'on' enables
/** Away at least this long before "open Save when Recall opens" fires again. */
const RELAUNCH_MS = 60_000

export type ClipboardAccess = 'granted' | 'prompt' | 'denied' | 'unsupported'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Private mode / blocked storage: the feature just won't remember.
  }
}

export const isDetectEnabled = () => read(DETECT_KEY) !== 'off'
export const setDetectEnabled = (on: boolean) => write(DETECT_KEY, on ? null : 'off')
export const isOpenOnLaunchEnabled = () => read(OPEN_ON_LAUNCH_KEY) === 'on'
export const setOpenOnLaunchEnabled = (on: boolean) => write(OPEN_ON_LAUNCH_KEY, on ? 'on' : null)

/** Don't offer this link from the clipboard again (it was offered, shared in, or saved). */
export const rememberOffered = (url: string) => write(LAST_KEY, url)

/** Only offer a copied link once. */
export function shouldOffer(url: string | null, lastOffered: string | null): url is string {
  return !!url && url !== lastOffered
}

export async function clipboardAccess(): Promise<ClipboardAccess> {
  if (!navigator.clipboard?.readText || !navigator.permissions?.query) return 'unsupported'
  try {
    const status = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName })
    return status.state
  } catch {
    return 'unsupported' // Safari/Firefox don't know this permission
  }
}

/** Ask for clipboard access. Must run inside a tap (a user gesture). */
export async function requestClipboardAccess(): Promise<ClipboardAccess> {
  try {
    const text = await navigator.clipboard.readText()
    // Whatever is copied right now was copied before turning this on: don't pop it up.
    const url = extractUrlFromText(text)
    if (url) rememberOffered(url)
  } catch {
    // Denied or dismissed; the state below says which.
  }
  return clipboardAccess()
}

async function copiedLinkToOffer(): Promise<string | null> {
  if (!isDetectEnabled() || (await clipboardAccess()) !== 'granted') return null
  try {
    const url = extractUrlFromText(await navigator.clipboard.readText())
    return shouldOffer(url, read(LAST_KEY)) ? url : null
  } catch {
    return null // e.g. the document isn't focused yet
  }
}

/**
 * When Recall opens or comes back to the foreground: offer a newly copied link
 * (where the browser allows it), else optionally just open the Save box.
 */
export function useSaveOnOpen(openSave: (prefill?: { url?: string }) => void, sheetOpen: boolean) {
  const sheetOpenRef = useRef(sheetOpen)
  useEffect(() => {
    sheetOpenRef.current = sheetOpen
  }, [sheetOpen])

  useEffect(() => {
    let hiddenAt: number | null = null
    let running = false

    async function check(launch: boolean) {
      // /save (share target, Shortcut) brings its own link.
      if (running || sheetOpenRef.current || document.visibilityState !== 'visible' || location.pathname === '/save') return
      running = true
      try {
        const url = await copiedLinkToOffer()
        if (sheetOpenRef.current) return
        if (url) {
          rememberOffered(url)
          openSave({ url })
        } else if (launch && isOpenOnLaunchEnabled()) {
          openSave()
        }
      } finally {
        running = false
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      const relaunch = hiddenAt !== null && Date.now() - hiddenAt >= RELAUNCH_MS
      hiddenAt = null
      void check(relaunch)
    }
    const onFocus = () => void check(false)

    void check(true)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [openSave])
}
