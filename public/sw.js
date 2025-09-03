self.addEventListener('install', (e) => {
self.skipWaiting()
})
self.addEventListener('activate', (e) => {
clients.claim()
})
self.addEventListener('fetch', (e) => {
e.respondWith(
caches.open('app-cache-v1').then(async (cache) => {
const cached = await cache.match(e.request)
if (cached) return cached
try {
const res = await fetch(e.request)
if (e.request.method === 'GET' && res.status === 200 && res.type === 'basic') {
cache.put(e.request, res.clone())
}
return res
} catch {
return cached || Response.error()
}
})
)
})