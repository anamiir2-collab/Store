/* =========================================================================
   service-worker.js — Offline caching for the Store & Inventory app
   ========================================================================= */

const CACHE_NAME = 'store-inventory-v1';
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
  // External CDN libraries — cached for offline use
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache assets one by one — don't fail all if some are unreachable
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(err => console.warn('SW: failed to cache', url, err)))
      );
    }).then(() => self.skipWaiting())
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
  // Only handle GET
  if (req.method !== 'GET') return;

  // Strategy: cache-first for app assets, network-first with fallback for everything else
  const url = new URL(req.url);
  const isAppAsset = url.origin === self.location.origin || ASSETS.includes(req.url) || ASSETS.includes(url.pathname);

  if (isAppAsset) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        // Cache new app assets
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return resp;
      }).catch(() => caches.match('./index.html')))
    );
  } else {
    // Network-first for external (e.g., Google Fonts)
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
