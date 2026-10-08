import { useEffect } from 'react'
import { toast } from 'sonner'
import { registerSW } from 'virtual:pwa-register'

const CHECK_INTERVAL_MS = 15 * 60 * 1000

/**
 * Registers the service worker and offers updates politely: a new version
 * never reloads the page under someone mid-save.
 *
 * Browsers only look for a new service worker on navigation, which an
 * installed PWA left open (or resumed from the background) rarely does. So we
 * also check whenever the app comes back to the foreground and on an interval
 * while it's visible — a fresh deploy shows the toast without a reopen.
 */
export function PwaUpdater() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
    let registration: ServiceWorkerRegistration | undefined

    const check = () => {
      if (!registration || document.visibilityState !== 'visible' || !navigator.onLine) return
      registration.update().catch(() => {
        // Offline or a flaky network — the next check will try again.
      })
    }

    const update = registerSW({
      onRegisteredSW(_url, reg) {
        registration = reg
      },
      onNeedRefresh() {
        toast('A new version of Recall is ready.', {
          id: 'pwa-update',
          duration: Infinity,
          action: { label: 'Update', onClick: () => void update(true) },
        })
      },
    })

    const interval = window.setInterval(check, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
    }
  }, [])
  return null
}
