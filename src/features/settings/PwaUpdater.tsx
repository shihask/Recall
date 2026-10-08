import { useEffect } from 'react'
import { toast } from 'sonner'
import { registerSW } from 'virtual:pwa-register'

/**
 * Registers the service worker and offers updates politely: a new version
 * never reloads the page under someone mid-save.
 */
export function PwaUpdater() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
    const update = registerSW({
      onNeedRefresh() {
        toast('A new version of Recall is ready.', {
          duration: Infinity,
          action: { label: 'Update', onClick: () => void update(true) },
        })
      },
    })
  }, [])
  return null
}
