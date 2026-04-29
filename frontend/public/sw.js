// Rural Health Connect — Service Worker (Offline-First PWA)
const CACHE_NAME = 'rhc-v1'
const OFFLINE_QUEUE_KEY = 'rhc-offline-queue'

// Critical assets to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/doctor',
  '/hospital',
  '/manifest.json',
]

// ── Install: cache static assets ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: serve from cache, queue API calls when offline ─────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // For case submission API — queue if offline
  if (url.pathname === '/api/v3/submit' && event.request.method === 'POST') {
    event.respondWith(
      fetch(event.request.clone()).catch(async () => {
        // Offline: save to queue in IndexedDB via postMessage
        const body = await event.request.clone().json().catch(() => ({}))
        const queuedCase = {
          local_id: `local-${Date.now()}`,
          payload: body,
          queued_at: new Date().toISOString(),
          status: 'pending',
        }

        // Notify all clients to save to IndexedDB
        const clients = await self.clients.matchAll()
        clients.forEach(client => client.postMessage({
          type: 'QUEUE_CASE',
          data: queuedCase,
        }))

        // Return a fake success so app continues
        return new Response(JSON.stringify({
          status: 'queued_offline',
          case_id: `OFFLINE-${Date.now()}`,
          message: 'Case saved. Will sync when connection returns.',
        }), { headers: { 'Content-Type': 'application/json' } })
      })
    )
    return
  }

  // For all other requests — network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful HTML/JS/CSS responses
        if (response.ok && ['/', '/doctor', '/hospital'].includes(url.pathname)) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request).then(r => r || new Response('Offline', { status: 503 })))
  )
})

// ── Sync: re-send queued cases when back online ────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncQueuedCases())
  }
})

async function syncQueuedCases() {
  const clients = await self.clients.matchAll()
  clients.forEach(client => client.postMessage({ type: 'SYNC_QUEUE' }))
}

// ── Push Notifications ─────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || '🚨 New Emergency Case', {
      body: data.body || 'A new case requires attention in your sector.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 400],
      data: { url: data.url || '/hospital' },
      actions: [
        { action: 'open', title: 'Open Dashboard' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'open' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data?.url || '/hospital'))
  }
})
