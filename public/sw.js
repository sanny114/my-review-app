const CACHE = 'app-cache-v3'; // ← v3 に上げて古いSWを確実に置き換える

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // http/https 以外は触らない（拡張・WS等のエラー回避）
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      if (cached) return cached;
      try {
        const res = await fetch(e.request);
        if (e.request.method === 'GET' && res.status === 200 && res.type === 'basic') {
          cache.put(e.request, res.clone());
        }
        return res;
      } catch {
        return cached || Response.error();
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});