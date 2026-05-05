// sw.js - Service Worker لتخزين الملفات الثابتة وتشغيل الموقع بدون إنترنت
const CACHE_NAME = 'markets-pwa-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(cacheNames.map(name => name !== CACHE_NAME && caches.delete(name)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const request = event.request;

  // استثناء طلبات Supabase API
  if (url.pathname.includes('/rest/v1/') || url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // للملفات الثابتة: Cache First
  if (['document', 'style', 'script', 'font'].includes(request.destination) || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        if (res.status === 200) caches.open(CACHE_NAME).then(cache => cache.put(request, res.clone()));
        return res;
      }))
    );
    return;
  }

  // للصور: Cache First ثم تحديث في الخلفية
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request).then(res => {
          if (res.status === 200) caches.open(CACHE_NAME).then(cache => cache.put(request, res.clone()));
          return res;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // لكل شيء آخر: Network First
  event.respondWith(
    fetch(request).then(res => {
      if (res.status === 200 && request.method === 'GET') caches.open(CACHE_NAME).then(cache => cache.put(request, res.clone()));
      return res;
    }).catch(() => caches.match(request))
  );
});
