// Python Discovery service worker: makes the PWA installable and fully offline after the first visit.
// Same-origin GETs are cache-first; page navigations are network-first with the cached shell as fallback.
const CACHE_NAME = 'pydisc-v1'
const CORE_FILES = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './pyodide/pyodide.mjs',
  './pyodide/pyodide.asm.mjs',
  './pyodide/pyodide.asm.wasm',
  './pyodide/python_stdlib.zip',
  './pyodide/pyodide-lock.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  )
})

// The page reports the hashed assets it already loaded, so they are cached even on the very first visit.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache-urls') return
  const sameOrigin = event.data.urls.filter((url) => new URL(url).origin === self.location.origin)
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(sameOrigin)))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('./'))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
