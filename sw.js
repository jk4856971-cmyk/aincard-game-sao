const CACHE_NAME = 'aincrad-cache-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './styles/style.css',
  './src/world.js',
  './src/town.js',
  './src/monsters.js',
  './src/combat.js',
  './src/player.js',
  './src/ui.js',
  './src/network.js',
  './src/save.js',
  './src/game.js',
];
// External libs — cached best-effort so solo play still works offline after first load.
// (Multiplayer/voice/Google sign-in need a live connection regardless.)
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(CORE_ASSETS.map(url =>
      cache.add(url).catch(()=>{ /* ignore individual failures */ })
    ));
    await Promise.all(CDN_ASSETS.map(url =>
      fetch(url, {mode:'no-cors'}).then(res => cache.put(url, res)).catch(()=>{})
    ));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if(cached) return cached;
    try{
      const fresh = await fetch(req);
      if(fresh && fresh.ok){
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
      }
      return fresh;
    }catch(err){
      // offline and not cached — nothing we can do for this resource
      return cached || Response.error();
    }
  })());
});
