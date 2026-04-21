const V = 'bgt-v2';
const STATIC = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(STATIC).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  // Don't cache Google API calls
  if(e.request.url.includes('googleapis.com') || e.request.url.includes('accounts.google.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(resp => {
        if(resp && resp.status === 200 && resp.type !== 'opaque') {
          const clone = resp.clone();
          caches.open(V).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
