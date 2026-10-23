/* Signal Home service worker.
 *
 * Caches ONLY same-origin static app files so the shell opens offline.
 * Supabase API/storage/realtime traffic is cross-origin and is never touched:
 * private media and authenticated responses are never written to a cache here.
 */
const VERSION = 'signal-home-v1'
const SHELL = ['/', '/offline.html', '/manifest.webmanifest', '/icons/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // never intercept Supabase or any third party
  if (url.pathname === '/capsule-viewer.html') return // always fresh: it hosts untrusted-ish legacy content

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(VERSION).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/').then((hit) => hit || caches.match('/offline.html'))),
    )
    return
  }

  // Hashed build assets are immutable: cache-first. Everything else: stale-while-revalidate.
  const immutable = url.pathname.startsWith('/assets/')
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit && immutable) return hit
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(VERSION).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => hit)
      return hit || network
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client)
      return existing ? existing.focus() : self.clients.openWindow('/')
    }),
  )
})
