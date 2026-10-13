// Editör uygulaması için basit service worker: uygulama kabuğunu önbelleğe alır,
// API isteklerine hiç dokunmaz (her zaman canlı veri).
const SURUM = 'ivm-editor-v2';
const KABUK = ['/editor/', '/editor/manifest.webmanifest', '/editor/ikon-192.png', '/editor/ikon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SURUM).then(c => c.addAll(KABUK)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== SURUM).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/editor/')) return;
  // Önce ağ, bağlantı yoksa önbellek
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const kopya = r.clone(); caches.open(SURUM).then(c => c.put(e.request, kopya)); }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('/editor/')))
  );
});
