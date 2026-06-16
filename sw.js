const CACHE = 'pretrack-v1';
const STATIC = [
  '/Diecast-Tracking/',
  '/Diecast-Tracking/index.html',
  '/Diecast-Tracking/login.html',
  '/Diecast-Tracking/style.css',
  '/Diecast-Tracking/app.js',
  '/Diecast-Tracking/manifest.json'
];

// Install — cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, fall back to cache
self.addEventListener('fetch', e => {
  // Skip Firebase/Supabase API calls — always go network
  if (e.request.url.includes('firestore') ||
      e.request.url.includes('firebase') ||
      e.request.url.includes('supabase') ||
      e.request.url.includes('googleapis')) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache fresh copy of static assets
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
