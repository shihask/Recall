/// <reference lib="webworker" />
// Recall service worker.
//
// What it does: precaches the app shell so Recall opens instantly (and opens
// at all when offline), and serves index.html for in-app navigations.
// What it deliberately does NOT do: cache Supabase/API responses. Saves and
// notes are private; they're never written to a shared cache on the device.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA navigations (including the /save share-target URL) → cached shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/auth\/callback/] }))

// The page asks before activating a new version (see usePwaUpdate).
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting()
})
