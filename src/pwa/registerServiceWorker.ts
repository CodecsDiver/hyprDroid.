import { isNativeRuntime } from '../backend/backend'

/**
 * Registers the offline-caching service worker for the PWA build only (never in the desktop app,
 * never in the dev server, where cached files would mask changes).
 */
export async function registerServiceWorker(): Promise<void> {
  if (isNativeRuntime() || import.meta.env.MODE !== 'web' || !('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
    const registration = await navigator.serviceWorker.ready
    // Hand the worker the hashed assets this page already loaded so a first visit works offline too.
    const loadedUrls = performance.getEntriesByType('resource').map((entry) => entry.name)
    registration.active?.postMessage({ type: 'cache-urls', urls: [location.href, ...loadedUrls] })
  } catch (error) {
    console.warn('Offline support could not be enabled', error)
  }
}
