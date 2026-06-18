const CACHE = 'pretrack-v4';
const STATIC = [
  '/Diecast-Tracking/',
  '/Diecast-Tracking/index.html',
  '/Diecast-Tracking/style.css',
  '/Diecast-Tracking/manifest.json'
];

// DO NOT cache login.html or app.js — they contain injected secrets
// that must always be fresh from the server

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('SW: deleting old cache', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Always go to network for these — never serve from cache
  if (url.includes('login.html') ||
      url.includes('app.js') ||
      url.includes('firestore') ||
      url.includes('firebase') ||
      url.includes('supabase') ||
      url.includes('googleapis') ||
      url.includes('gstatic')) {
    return; // Let browser handle normally
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
