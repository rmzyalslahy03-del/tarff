// sw.js - Service Worker متقدم لتخزين الموقع بالكامل على متصفحات الزوار
// الإصدار النهائي - يدعم التخزين المؤقت، التحديث التلقائي، والعمل بدون إنترنت

const CACHE_NAME = 'asawq-store-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js'
];

// تثبيت الـ Service Worker وتخزين الملفات الأساسية
self.addEventListener('install', event => {
  console.log('[SW] تثبيت الإصدار الجديد');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] تخزين الملفات الأساسية');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(err => console.error('[SW] فشل تخزين بعض الملفات:', err))
  );
  self.skipWaiting(); // تفعيل فوراً
});

// تفعيل الـ SW وحذف المخازن القديمة
self.addEventListener('activate', event => {
  console.log('[SW] تفعيل الإصدار الجديد');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            console.log('[SW] حذف الكاش القديم:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim(); // السيطرة على الصفحات المفتوحة فوراً
});

// استراتيجية متقدمة للتعامل مع الطلبات
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // استثناء طلبات Supabase API (لا نخزنها محلياً)
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/rest/v1/')) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }
  
  // للملفات الثابتة (HTML, CSS, JS, fonts) - استراتيجية Cache First مع تحديث الخلفية
  if (request.destination === 'document' || 
      request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'font' ||
      url.pathname === '/' ||
      url.pathname === '/index.html' ||
      url.pathname === '/admin.html' ||
      url.pathname === '/manifest.json') {
    
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        const fetchPromise = fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, networkResponse.clone());
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);
        
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
  
  // للصور - Cache First ثم تحديث في الخلفية
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, res.clone()));
          }
          return res;
        }).catch(() => null);
        return cached || fetchPromise;
      })
    );
    return;
  }
  
  // لجميع الطلبات الأخرى (مثل API خارجية) - Network First
  event.respondWith(
    fetch(request).then(networkResponse => {
      if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
        caches.open(CACHE_NAME).then(cache => cache.put(request, networkResponse.clone()));
      }
      return networkResponse;
    }).catch(() => caches.match(request))
  );
});

// استقبال رسائل من الصفحة لتحديث فوري
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
