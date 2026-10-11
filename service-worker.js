/* =========================================================================
   service-worker.js — Offline caching for the Store & Inventory app
   ========================================================================= */

// Bump this version whenever app files change so mobile browsers discard stale JS/CSS.
const CACHE_NAME = 'store-inventory-v2';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/db.js',
  './js/app.js',
  './js/products.js',
  './js/import-export.js',
  './js/pos.js',
  './js/invoices.js',
  './js/inventory.js',
  './js/purchases.js',
  './js/customers.js',
  './js/expenses.js',
  './js/alerts.js',
  './js/dashboard.js',
  './js/reports.js',
  './js/settings.js',
  './js/backup.js',
  './manifest.json',
  './assets/icons/icon.svg',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(err => console.warn('SW: failed to cache', url, err)))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isAppAsset = url.origin === self.location.origin || ASSETS.includes(req.url) || ASSETS.includes(url.pathname);

  if (isAppAsset) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return resp;
      }).catch(() => caches.match('./index.html')))
    );
  } else {
    e.respondWith(
      fetch(req).then(resp => {
        if (resp.ok && (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com' || url.origin === 'https://cdn.jsdelivr.net')) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return resp;
      }).catch(() => caches.match(req))
    );
  }
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
