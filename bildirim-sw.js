// Haber bildirimleri: sunucudan gelen bildirimi gösterir, tıklanınca haberi açar
self.addEventListener('push', function (e) {
  var v = {};
  try { v = e.data ? e.data.json() : {}; } catch (err) { v = { baslik: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(v.baslik || 'İzmir Voleybol Medya', {
    body: v.metin || 'Yeni haber yayınlandı',
    icon: '/editor/ikon-192.png',
    badge: '/editor/ikon-192.png',
    image: v.gorsel || undefined,
    tag: v.etiket || 'haber',
    data: { url: v.url || '/' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (pencereler) {
    for (var i = 0; i < pencereler.length; i++) {
      if (new URL(pencereler[i].url).pathname === new URL(url, self.location.origin).pathname && 'focus' in pencereler[i]) return pencereler[i].focus();
    }
    return clients.openWindow(url);
  }));
});
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
