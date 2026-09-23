/* =========================================================
   VoiceStudio AI — service-worker.js
   Cache-first for the app shell so the interface (not AI
   results) works offline / installs as a PWA. Bump CACHE_NAME
   whenever shipped files change so old caches get cleared.
   ========================================================= */

const CACHE_NAME = 'voicestudio-ai-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './responsive.css',
  './storage.js',
  './audio.js',
  './recorder.js',
  './settings.js',
  './api-client.js',
  './tts-service.js',
  './voice-service.js',
  './dubbing-service.js',
  './podcast-service.js',
  './audiobook-service.js',
  './music-service.js',
  './projects.js',
  './ui.js',
  './app.js',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Never cache calls to a connected AI backend — always go to the network.
  if (req.url.includes('/api/')) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
